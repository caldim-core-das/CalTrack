import React, { useState, useEffect, useRef, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { useGoogleLogin } from "@react-oauth/google"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, MapPin, Phone, Mail, User, Shield, CheckCircle2, Star,
  ChevronRight, ChevronLeft, ArrowLeft, Clock, Calendar, Camera,
  Upload, AlertCircle, Check, X, Info, Zap, Lock, Settings,
  Droplets, Wind, Bug, Brush, Cpu, Hammer, Package, Sparkles,
  Home, RefreshCw, MessageSquare, KeyRound, ShieldCheck,
  LogIn, ChevronDown, Award, Users, ThumbsUp, ArrowRight,
  FileText, CheckCheck, Phone as PhoneIcon, ShoppingCart,
  CreditCard, Wallet, Tag as TagIcon, Bell, LifeBuoy, LogOut, Ticket
} from "lucide-react"
import {
  apiRequestCustomerEmailOTP, apiVerifyCustomerEmailOTP,
  apiRequestCustomerPhoneOTP, apiVerifyCustomerPhoneOTP,
  apiFetchCustomerBookings, apiLogout, apiCustomerGoogleLogin, extractAuthError
} from "../../api/authService.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { apiRequest } from "../../api/client.js"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";

let BOOKING_CURRENCY_SYMBOL = "₹";

/* ─────────────────────────────────────────────────────────────────────────
   DATA
   ───────────────────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { id: "cleaning", name: "Home Cleaning", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&q=80&fit=crop", desc: "Deep clean & sanitization", rating: "4.8", jobs: "50K+" },
  { id: "plumbing", name: "Plumbing", image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=500&q=80&fit=crop", desc: "Leaks, pipes & fixtures", rating: "4.7", jobs: "30K+" },
  { id: "electrical", name: "Electrical", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&q=80&fit=crop", desc: "Wiring, panels & lighting", rating: "4.8", jobs: "40K+" },
  { id: "carpentry", name: "Carpentry", image: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&q=80&fit=crop", desc: "Furniture & wood repairs", rating: "4.6", jobs: "15K+" },
  { id: "hvac", name: "AC & Heating", image: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=500&q=80&fit=crop", desc: "AC service & installation", rating: "4.9", jobs: "60K+" },
  { id: "pest_control", name: "Pest Control", image: "https://images.unsplash.com/photo-1517825738774-7de9363ef735?w=500&q=80&fit=crop", desc: "Termites, cockroaches & more", rating: "4.7", jobs: "25K+" },
  { id: "painting", name: "Painting", image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500&q=80&fit=crop", desc: "Walls, ceilings & textures", rating: "4.6", jobs: "20K+" },
  { id: "appliance_repair", name: "Appliances", image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&q=80&fit=crop", desc: "Fridge, washer & oven repairs", rating: "4.8", jobs: "35K+" },
  { id: "security", name: "Security Systems", image: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=500&q=80&fit=crop", desc: "CCTV & alarm systems", rating: "4.7", jobs: "10K+" },
  { id: "general", name: "General Repair", image: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=500&q=80&fit=crop", desc: "Handyman & misc tasks", rating: "4.5", jobs: "45K+" },
]

function openGoogleSignInPopup(onSuccess, onError) {
  const runSignIn = () => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      if (typeof onError === 'function') onError("Google login service is not available. Please refresh the page.");
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: "628867483502-e7snj6l150js2vpvkv70opo5h4aacgus.apps.googleusercontent.com",
        scope: "email profile openid",
        callback: (response) => {
          try {
            if (response && response.access_token) {
              if (typeof onSuccess === 'function') {
                Promise.resolve(onSuccess(response.access_token)).catch(err => {
                  if (typeof onError === 'function') onError(err?.message || "Google login failed.");
                });
              }
            } else if (response && response.error) {
              if (typeof onError === 'function') onError(response.error_description || "Google login cancelled or failed.");
            } else {
              if (typeof onError === 'function') onError("Google login cancelled.");
            }
          } catch (e) {
            if (typeof onError === 'function') onError("Failed to process Google sign-in token.");
          }
        },
        error_callback: (err) => {
          if (typeof onError === 'function') onError(err?.message || "Google login error");
        }
      });
      if (client && typeof client.requestAccessToken === 'function') {
        try {
          client.requestAccessToken();
        } catch (reqErr) {
          if (typeof onError === 'function') onError("Browser blocked the Google login popup.");
        }
      }
    } catch (err) {
      if (typeof onError === 'function') onError(err?.message || "Failed to initialize Google login");
    }
  };

  if (!window.google?.accounts?.oauth2) {
    let script = document.getElementById("google-gsi-client");
    if (!script) {
      script = document.createElement("script");
      script.id = "google-gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.onload = () => runSignIn();
    script.onerror = () => {
      if (typeof onError === 'function') onError("Failed to load Google Sign-In SDK.");
    };
    if (window.google?.accounts?.oauth2) {
      runSignIn();
    }
  } else {
    runSignIn();
  }
}

const PACKAGES = {
  cleaning: [
    { id: "clean-std", name: "Standard", price: 999, priceStr: "₹999", duration: "2 hrs", popular: false, tag: "", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&q=80&fit=crop", includes: ["Floor Cleaning", "Kitchen Surface Cleaning", "Bathroom Cleaning", "Dusting"], excludes: [] },
    { id: "clean-prem", name: "Premium", price: 2499, priceStr: "₹2,499", duration: "4 hrs", popular: true, tag: "Most Booked", image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300&q=80&fit=crop", includes: ["Complete Home Deep Cleaning", "Kitchen Deep Cleaning", "Bathroom Deep Cleaning", "Sofa Vacuuming", "Window Cleaning", "Balcony Cleaning"], excludes: [] },
    { id: "clean-move", name: "Move-In / Move-Out Package", price: 3499, priceStr: "₹3,499", duration: "6 hrs", popular: false, tag: "Best Value", image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=300&q=80&fit=crop", includes: ["Entire House Cleaning", "Cabinet Cleaning", "Fan & Light Cleaning", "Window & Glass Cleaning"], excludes: [] },
  ],
  plumbing: [
    { id: "plum-std", name: "Standard", price: 299, priceStr: "₹299", duration: "1 hr", popular: false, tag: "", includes: ["One Plumbing Issue", "Leak Check", "Basic Repair"], excludes: [] },
    { id: "plum-prem", name: "Premium", price: 799, priceStr: "₹799", duration: "2 hrs", popular: true, tag: "Most Booked", image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=300&q=80&fit=crop", includes: ["Up to 3 Plumbing Repairs", "Pipe Inspection", "Drain Cleaning"], excludes: [] },
    { id: "plum-comp", name: "Complete Home Plumbing", price: 1999, priceStr: "₹1,999", duration: "3 hrs", popular: false, tag: "Best Value", image: "https://images.unsplash.com/photo-1607472586893-edb57cb3b4e1?w=300&q=80&fit=crop", includes: ["Full House Plumbing Inspection", "Multiple Repairs", "Water Pressure Check"], excludes: [] },
  ],
  electrical: [
    { id: "elec-std", name: "Standard", price: 299, priceStr: "₹299", duration: "1 hr", popular: false, tag: "", includes: ["One Electrical Repair", "Safety Check"], excludes: [] },
    { id: "elec-prem", name: "Premium", price: 899, priceStr: "₹899", duration: "2 hrs", popular: true, tag: "Most Booked", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300&q=80&fit=crop", includes: ["Multiple Electrical Repairs", "Wiring Inspection", "MCB Check"], excludes: [] },
    { id: "elec-care", name: "Home Electrical Care", price: 1999, priceStr: "₹1,999", duration: "3 hrs", popular: false, tag: "Best Value", image: "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=300&q=80&fit=crop", includes: ["Complete Home Inspection", "Fan & Light Service", "Socket Testing"], excludes: [] },
  ],
  hvac: [
    { id: "hvac-std", name: "Standard Package", price: 599, priceStr: "₹599", duration: "1-2 Hrs", popular: true, tag: "Most Booked", image: "https://images.unsplash.com/photo-1621905252507-b35492d04029?w=300&q=80&fit=crop", includes: ["General AC Service", "Filter Cleaning", "Cooling Performance Check", "Basic Inspection"], excludes: [] },
    { id: "hvac-prem", name: "Premium Package", price: 1299, priceStr: "₹1,299", duration: "2-3 Hrs", popular: false, tag: "", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=300&q=80&fit=crop", includes: ["Deep Coil Cleaning", "Water Jet Cleaning", "Filter Cleaning", "Cooling Performance Check", "Gas Pressure Check", "Minor Adjustments", "30-Day Service Warranty"], excludes: [] },
    { id: "hvac-amc", name: "Annual Maintenance Package (AMC)", price: 2999, priceStr: "₹2,999", duration: "Yearly", popular: false, tag: "Best Value", image: "https://images.unsplash.com/photo-1610486842247-7505ed272fc4?w=300&q=80&fit=crop", includes: ["4 AC Services per Year", "Priority Technician", "Discount on Spare Parts", "Free Basic Inspection", "Service Reminder"], excludes: [] },
  ],
  appliance_repair: [
    { id: "app-std", name: "Standard", price: 399, priceStr: "₹399", duration: "1 hr", popular: false, tag: "", includes: ["Appliance Diagnosis", "Basic Repair"], excludes: [] },
    { id: "app-prem", name: "Premium", price: 999, priceStr: "₹999", duration: "2 hrs", popular: true, tag: "Most Booked", image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=300&q=80&fit=crop", includes: ["Complete Servicing", "Internal Cleaning", "Performance Testing"], excludes: [] },
    { id: "app-amc", name: "Annual Care Plan", price: 2499, priceStr: "₹2,499", duration: "Yearly", popular: false, tag: "Best Value", includes: ["3 Service Visits", "Priority Support", "Discount on Parts"], excludes: [] },
  ],
  security: [
    { id: "check", name: "System Check", price: 499, priceStr: "₹499", duration: "1 hr", popular: false, tag: "", includes: ["Camera test", "DVR check", "App verify"], excludes: ["New cables", "Repositioning"] },
    { id: "install2", name: "2-Camera Setup", price: 2999, priceStr: "₹2,999", duration: "3 hrs", popular: true, tag: "Most Booked", includes: ["2 HD cameras", "DVR setup", "Mobile app config", "Cabling"], excludes: ["Monthly plan"] },
    { id: "install4", name: "4-Camera Setup", price: 4999, priceStr: "₹4,999", duration: "5 hrs", popular: false, tag: "Best Value", includes: ["4 HD cameras", "DVR", "App", "Night vision", "1-yr warranty"], excludes: [] },
  ],
  general: [
    { id: "basic", name: "1 Hr Handyman", price: 299, priceStr: "₹299", duration: "1 hr", popular: false, tag: "", includes: ["Any general task", "Basic tools"], excludes: ["Materials", "Electrical/plumbing"] },
    { id: "standard", name: "2 Hr Handyman", price: 499, priceStr: "₹499", duration: "2 hrs", popular: true, tag: "Most Booked", includes: ["Multiple small tasks", "Tools included", "Experienced pro"], excludes: ["Materials"] },
    { id: "complete", name: "Full Day Pro", price: 999, priceStr: "₹999", duration: "8 hrs", popular: false, tag: "Best Value", includes: ["Unlimited tasks", "All tools", "Priority scheduling"], excludes: ["Materials above ₹500"] },
  ],
  carpentry: [
    { id: "carp-std", name: "Standard Repair", price: 499, priceStr: "₹499", duration: "2 hrs", popular: false, tag: "", image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300&q=80&fit=crop", includes: ["Minor Woodwork", "Hinge Replacement", "Basic Fixes"], excludes: [] },
    { id: "carp-prem", name: "Premium Setup", price: 999, priceStr: "₹999", duration: "4 hrs", popular: true, tag: "Most Booked", image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300&q=80&fit=crop", includes: ["Furniture Assembly", "Custom Shelving", "Door Alignment"], excludes: [] },
    { id: "carp-full", name: "Full Day Carpentry", price: 1999, priceStr: "₹1,999", duration: "8 hrs", popular: false, tag: "Best Value", image: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=300&q=80&fit=crop", includes: ["Extensive Repairs", "New Installations", "Material Shopping"], excludes: [] },
  ],
  pest_control: [
    { id: "pest-std", name: "Basic Pest Control", price: 799, priceStr: "₹799", duration: "1 hr", popular: false, tag: "", image: "https://images.unsplash.com/photo-1517825738774-7de9363ef735?w=300&q=80&fit=crop", includes: ["Cockroach & Ant Spray", "Targeted Areas"], excludes: [] },
    { id: "pest-prem", name: "Comprehensive Treatment", price: 1499, priceStr: "₹1,499", duration: "2 hrs", popular: true, tag: "Most Booked", image: "https://images.unsplash.com/photo-1517825738774-7de9363ef735?w=300&q=80&fit=crop", includes: ["Full Home Spray", "Termite Check", "Bedbug Treatment"], excludes: [] },
    { id: "pest-year", name: "Annual Pest Protection", price: 3499, priceStr: "₹3,499", duration: "Yearly", popular: false, tag: "Best Value", image: "https://images.unsplash.com/photo-1628102491629-778586284000?w=300&q=80&fit=crop", includes: ["3 Service Visits", "Priority Response", "Guarantee"], excludes: [] },
  ],
  painting: [
    { id: "paint-room", name: "Single Room Makeover", price: 2999, priceStr: "₹2,999", duration: "1 day", popular: false, tag: "", image: "https://images.unsplash.com/photo-1562259942-27364e0ee76b?w=300&q=80&fit=crop", includes: ["Basic Prep", "2 Coats Paint", "Cleanup"], excludes: [] },
    { id: "paint-home", name: "Complete Home Painting", price: 9999, priceStr: "₹9,999", duration: "4 days", popular: true, tag: "Most Booked", image: "https://images.unsplash.com/photo-1562259942-27364e0ee76b?w=300&q=80&fit=crop", includes: ["Wall Putty", "Primer", "Premium Paint", "Post-Cleanup"], excludes: [] },
    { id: "paint-prem", name: "Texture & Decor Painting", price: 14999, priceStr: "₹14,999", duration: "5 days", popular: false, tag: "Best Value", image: "https://images.unsplash.com/photo-1584820927500-11b3337a7c5a?w=300&q=80&fit=crop", includes: ["Custom Textures", "Accent Walls", "Designer Finish"], excludes: [] },
  ],
}

const TIME_SLOTS = [
  { period: "Afternoon", icon: "â˜€ï¸", slots: [{ t: "12:00", l: "12:00 PM" }, { t: "13:00", l: "1:00 PM" }, { t: "14:00", l: "2:00 PM" }, { t: "15:00", l: "3:00 PM" }, { t: "16:00", l: "4:00 PM" }] },
  { period: "Evening", icon: "🌆", slots: [{ t: "17:00", l: "5:00 PM" }, { t: "18:00", l: "6:00 PM" }, { t: "19:00", l: "7:00 PM" }] },
]

const REVIEWS = [
  { name: "Priya S.", rating: 5, text: "Amazing service! The technician was on time and very professional. Will definitely book again.", cat: "cleaning", ago: "2 days ago", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop" },
  { name: "Rahul M.", rating: 5, text: "Fixed my AC perfectly. Explained everything clearly and the price was very reasonable.", cat: "hvac", ago: "5 days ago", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop" },
  { name: "Anita K.", rating: 5, text: "Super clean work. Our bathroom looks brand new after the deep clean.", cat: "cleaning", ago: "1 week ago", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop" },
  { name: "Sanjay P.", rating: 5, text: "Wiring issue sorted in under an hour. Very knowledgeable electrician.", cat: "electrical", ago: "3 days ago", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop" },
]

function getRelativeTime(isoString) {
  if (!isoString) return "Recently";
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function generateAvatarUrl(name) {
  const n = name || "C";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random&color=fff&size=150`;
}

const OTP_SESSION_KEY = "bk_cust_verified"

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────────────── */

const DEFAULT_CAT_IMAGES = {
  hvac: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=500&q=80&fit=crop",
  appliances: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&q=80&fit=crop",
  appliance_repair: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&q=80&fit=crop",
  cleaning: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&q=80&fit=crop",
  plumbing: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=500&q=80&fit=crop",
  electrical: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&q=80&fit=crop",
  carpentry: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&q=80&fit=crop",
  pest_control: "https://images.unsplash.com/photo-1517825738774-7de9363ef735?w=500&q=80&fit=crop",
  painting: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500&q=80&fit=crop",
  security: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=500&q=80&fit=crop",
  general: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=500&q=80&fit=crop",
}

function getCategoryFallbackImage(name = "", slug = "") {
  const s = (slug || "").toLowerCase();
  const n = (name || "").toLowerCase();
  for (const [key, val] of Object.entries(DEFAULT_CAT_IMAGES)) {
    if (s.includes(key) || n.includes(key) || (key === "hvac" && (n.includes("ac") || n.includes("heating")))) {
      return val;
    }
  }
  return "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&q=80&fit=crop";
}

function formatErrorMessage(err, defaultMsg = "An error occurred") {
  if (!err) return defaultMsg;
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;
  if (typeof err.detail === "string") return err.detail;
  if (err.body) {
    if (typeof err.body === "string") return err.body;
    if (typeof err.body.message === "string") return err.body.message;
    if (typeof err.body.detail === "string") return err.body.detail;
    if (typeof err.body === "object") {
      const msgs = [];
      for (const [key, val] of Object.entries(err.body)) {
        const strVal = Array.isArray(val) ? val.join(", ") : (typeof val === "object" ? JSON.stringify(val) : String(val));
        msgs.push(`${key}: ${strVal}`);
      }
      if (msgs.length > 0) return msgs.join(" | ");
    }
  }
  if (typeof err === "object") {
    const msgs = [];
    for (const [key, val] of Object.entries(err)) {
      if (key === "success" || key === "status") continue;
      const strVal = Array.isArray(val) ? val.join(", ") : (typeof val === "object" ? JSON.stringify(val) : String(val));
      msgs.push(`${key}: ${strVal}`);
    }
    if (msgs.length > 0) return msgs.join(" | ");
  }
  return String(err);
}

function getFullImageUrl(rawUrl, catName = "", catSlug = "") {
  const url = typeof rawUrl === "string" ? rawUrl.trim() : (rawUrl?.url || "");
  if (!url) return getCategoryFallbackImage(catName, catSlug);

  if (typeof url === "string" && url.includes("/media/")) {
    const idx = url.indexOf("/media/");
    return url.substring(idx);
  }

  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }

  if (url.startsWith("media/")) {
    return `/${url}`;
  }

  if (url.startsWith("avatars/") || url.startsWith("catalog/") || url.startsWith("services/")) {
    return `/media/${url}`;
  }

  if (url.startsWith("/")) {
    return url;
  }

  if (url.includes(".") || url.includes("-") || url.includes("_")) {
    return `/media/catalog/${url}`;
  }

  return getCategoryFallbackImage(catName, catSlug);
}

function getNextDays(n = 21) {
  const out = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const dayStr = String(d.getDate()).padStart(2, '0')
    out.push({
      iso: `${year}-${month}-${dayStr}`,
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.getDate(),
      month: d.toLocaleDateString("en-IN", { month: "short" }),
      today: i === 0,
    })
  }
  return out
}

const DAYS_LIST = getNextDays(21)

/* ─────────────────────────────────────────────────────────────────────────
   MINI COMPONENTS
   ───────────────────────────────────────────────────────────────────────── */

function Tag({ children, color = "#7C3AED" }) {
  return (
    <span style={{
      background: color + "18", color,
      borderRadius: 99, padding: "2px 9px",
      fontSize: "0.62rem", fontWeight: 800,
      letterSpacing: "0.04em", textTransform: "uppercase",
      border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

function StarRow({ rating = 4.8, count, size = 12 }) {
  const full = Math.floor(rating)
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} style={{ fill: i <= full ? "#F59E0B" : "none", color: i <= full ? "#F59E0B" : "#e2e8f0" }} />
      ))}
      <span style={{ fontSize: size * 0.9, fontWeight: 700, color: "#1e293b", marginLeft: 3 }}>{rating}</span>
      {count && <span style={{ fontSize: size * 0.8, color: "#94a3b8" }}>({count})</span>}
    </span>
  )
}

function ProgressBar({ step, total }) {
  return (
    <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
      <motion.div
        style={{ height: "100%", background: "linear-gradient(90deg,#7C3AED,#a855f7)", borderRadius: 2 }}
        initial={{ width: 0 }}
        animate={{ width: `${(step / total) * 100}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  )
}

function SummaryBar({ category, cart, date, time, step }) {
  if (step < 3 || !category) return null
  const totalItems = cart ? cart.reduce((a, c) => a + c.quantity, 0) : 0;
  const totalPrice = cart ? cart.reduce((a, c) => a + (c.price * c.quantity), 0) : 0;

  return (
    <div style={{
      background: "white", borderBottom: "1px solid #e2e8f0",
      padding: "0.6rem 1.5rem",
      display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
      fontSize: "0.72rem", fontWeight: 700, color: "#475569",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: "1rem" }}>{category.emoji}</span> {category.name}
      </span>
      {cart && cart.length > 0 && <>
        <ChevronRight size={12} style={{ color: "#cbd5e1" }} />
        <span style={{ color: "#7C3AED" }}>{totalItems} item{totalItems > 1 ? 's' : ''} · {BOOKING_CURRENCY_SYMBOL}{totalPrice}</span>
      </>}
      {date && <>
        <ChevronRight size={12} style={{ color: "#cbd5e1" }} />
        <span><Calendar size={11} style={{ verticalAlign: "middle" }} /> {date}</span>
      </>}
      {time && <>
        <Clock size={11} style={{ verticalAlign: "middle" }} /> {time}
      </>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STEP 1 — HOME (Hero + Services)
   ───────────────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────
   LOCATION PICKER MODAL
   ───────────────────────────────────────────────────────────────────────── */
function LocationPickerModal({ onClose, onConfirm, initialLocation }) {
  const [search, setSearch] = useState(initialLocation || "")
  const [isFetching, setIsFetching] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [mapCenter, setMapCenter] = useState([28.524, 77.204]) // Default fallback
  const [searchResults, setSearchResults] = useState([])
  const [mapObj, setMapObj] = useState(null)
  const isTyping = useRef(false)

  // Center map on user's current location when modal opens
  useEffect(() => {
    if (navigator.geolocation && mapObj) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setMapCenter([lat, lon]);
        mapObj.flyTo([lat, lon], 14);
      }, (err) => {
        console.error("Geolocation failed", err);
      });
    }
  }, [mapObj]);

  // Fetch location suggestions when typing
  useEffect(() => {
    if (!search || search.length < 3 || !isTyping.current) {
      if (!search) setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(search)}&limit=5`);
        const data = await res.json();
        if (data && data.features) {
          const formatted = data.features.map(f => {
            const p = f.properties;
            const display = [p.name, p.street, p.city, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
            return {
              display_name: display,
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0]
            }
          });
          setSearchResults(formatted);
        } else {
          setSearchResults([]);
        }
      } catch (err) { console.error(err); }
      setIsSearching(false);
    }, 600)
    return () => clearTimeout(delayDebounce)
  }, [search])

  function MapEvents() {
    const map = useMapEvents({
      moveend: async (e) => {
        const center = e.target.getCenter();
        setMapCenter([center.lat, center.lng]);

        setIsFetching(true);
        try {
          const res = await fetch(`https://photon.komoot.io/reverse?lon=${center.lng}&lat=${center.lat}`);
          const data = await res.json();
          if (data && data.features && data.features.length > 0) {
            const p = data.features[0].properties;
            const display = [p.name, p.street, p.city, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
            isTyping.current = false;
            setSearch(display);
            setSearchResults([]); // clear suggestions when dragged manually
          }
        } catch (err) {
          console.error("Geocoding failed", err);
        }
        setIsFetching(false);
      }
    });
    useEffect(() => { if (!mapObj) setMapObj(map) }, [map, mapObj])
    return null;
  }

  const handleSelectResult = (result) => {
    isTyping.current = false;
    setSearch(result.display_name);
    setSearchResults([]);
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setMapCenter([lat, lon]);
    if (mapObj) {
      mapObj.flyTo([lat, lon], 14);
    }
  }

  return (
    <div className="uc-modal-overlay" onClick={onClose} style={{ zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        className="uc-step-container"
        style={{ width: '100%', maxWidth: 550, padding: 0, overflow: 'hidden', margin: '2rem' }}
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e293b', padding: 0, display: 'flex' }}><ArrowLeft size={20} /></button>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>Select Location</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Your service will be booked here</p>
          </div>
        </div>

        {/* Interactive Map Placeholder */}
        <div style={{ width: '100%', height: 250, position: 'relative', background: '#e2e8f0' }}>
          <MapContainer
            center={mapCenter}
            zoom={14}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            <MapEvents />
          </MapContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1000 }}>
            <div style={{ transform: 'translateY(-18px)', color: '#ef4444', filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.3))' }}>
              <MapPin size={42} fill="#ef4444" color="white" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div className="uc-input-wrap" style={{ marginBottom: '1rem' }}>
            <Search size={16} className="uc-field-icon" />
            <input
              className="uc-input"
              placeholder={isFetching ? "Locating on map..." : "Search for area, street name..."}
              value={search}
              onChange={e => {
                isTyping.current = true;
                setSearch(e.target.value);
              }}
              autoFocus
            />
          </div>

          <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: '1.5rem' }}>
            {isSearching && (
              <div style={{ padding: '0.75rem', textAlign: 'center', color: '#7C3AED', fontSize: '0.85rem', fontWeight: 600 }}>
                Searching...
              </div>
            )}
            {isTyping.current && search.length > 2 && searchResults.length === 0 && !isSearching && !isFetching && (
              <div style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No matches found. Try a different spelling or more specific area.
              </div>
            )}
            {searchResults.map((loc, i) => (
              <div
                key={i}
                style={{ padding: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: search === loc.display_name ? '#f8fafc' : 'white' }}
                onClick={() => handleSelectResult(loc)}
              >
                <MapPin size={16} color={search === loc.display_name ? '#7C3AED' : '#94a3b8'} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: search === loc.display_name ? '#7C3AED' : '#1e293b' }}>{loc.display_name.split(',')[0]}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{loc.display_name}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="uc-btn-primary uc-btn-full" onClick={() => onConfirm(search)} disabled={isFetching || !search}>
            Confirm Location
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function StepHome({ searchQuery, setSearchQuery, onSelect, categories, dynamicReviews }) {
  const [rotIdx, setRotIdx] = useState(0)
  const safeCats = categories && categories.length > 0 ? categories : CATEGORIES;
  const featured = safeCats.slice(0, 6)
  const rotWords = featured.map(c => c.name)

  useEffect(() => {
    const t = setInterval(() => setRotIdx(i => (i + 1) % rotWords.length), 4500)
    return () => clearInterval(t)
  }, [rotWords.length])

  const filtered = searchQuery
    ? safeCats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.desc.toLowerCase().includes(searchQuery.toLowerCase()))
    : safeCats

  return (
    <>
      <div className="uc-home-wrapper">
        <div className="uc-home-left">
          {/* Hero */}
          <div className="uc-hero">
            <div className="uc-hero-inner">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                <p className="uc-hero-tag">⭐ India's #1 Home Services Platform</p>
                <h1 className="uc-hero-h1">
                  Professional
                  <br />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={rotIdx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.8 }}
                      className="uc-hero-rotate"
                    >
                      {rotWords[rotIdx]}
                    </motion.span>
                  </AnimatePresence>
                  <br />
                  at your doorstep
                </h1>
                <p className="uc-hero-sub">Trained & verified experts · Transparent pricing · Real-time tracking</p>
              </motion.div>

              {/* Search Bar */}
              <motion.div className="uc-search-bar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Search size={18} className="uc-search-icon" />
                <input
                  className="uc-search-input"
                  placeholder="Search for services (e.g. AC repair, deep cleaning…)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="uc-search-clear" onClick={() => setSearchQuery("")}>
                    <X size={14} />
                  </button>
                )}
              </motion.div>

              {/* Trust pills */}
              <motion.div className="uc-trust-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <span><ShieldCheck size={13} /> Verified Pros</span>
                <span><Star size={13} style={{ fill: "#fbbf24", color: "#fbbf24" }} /> 4.8★ Rated</span>
                <span><Users size={13} /> 1M+ Happy Homes</span>
                <span><Award size={13} /> 30-Day Guarantee</span>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="uc-home-right">
          <div className="uc-feature-carousel">
            <AnimatePresence mode="wait">
              <motion.div
                key={featured[rotIdx].id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 1.2 }}
                className="uc-feature-slide"
              >
                <img
                  src={getFullImageUrl(featured[rotIdx].image, featured[rotIdx].name, featured[rotIdx].slug)}
                  alt={featured[rotIdx].name}
                  className="uc-feature-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = featured[rotIdx].fallbackImage || getCategoryFallbackImage(featured[rotIdx].name, featured[rotIdx].slug);
                  }}
                />
                <div className="uc-feature-overlay">
                  <div className="uc-feature-text">
                    <h3>{featured[rotIdx].name}</h3>
                    <p>{featured[rotIdx].desc}</p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '0.95rem', color: '#f1f5f9', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={14} style={{ fill: "#fbbf24", color: "#fbbf24" }} /> {featured[rotIdx].rating} Rated</span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> {featured[rotIdx].jobs} Bookings</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="uc-section">
        <div className="uc-section-header">
          <h2 className="uc-section-title">Our Services</h2>
          <p className="uc-section-sub">Pick a category to get started</p>
        </div>

        <div className="uc-cat-grid">
          {filtered.map((cat, i) => (
            <motion.button
              key={cat.id}
              className="uc-cat-card"
              onClick={() => onSelect(cat)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="uc-cat-img-wrap">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="uc-cat-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = cat.fallbackImage || getCategoryFallbackImage(cat.name, cat.slug);
                  }}
                />
                <div className="uc-cat-overlay">
                  <span className="uc-cat-btn">Book Now</span>
                </div>
              </div>
              <div className="uc-cat-body">
                <div className="uc-cat-name">{cat.name}</div>
                <div className="uc-cat-desc">{cat.desc}</div>
                <div className="uc-cat-meta">
                  <StarRow rating={cat.rating} size={11} />
                  <span className="uc-cat-jobs">{cat.jobs} bookings</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
            <Search size={32} style={{ margin: "0 auto 0.75rem" }} />
            <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>No services found for "{searchQuery}"</p>
          </div>
        )}
      </div>

      <div>
        {/* How it Works */}
        <div className="uc-how">
          <h2 className="uc-section-title" style={{ textAlign: "center" }}>How it works</h2>
          <p className="uc-section-sub" style={{ textAlign: "center" }}>Book a service in 3 simple steps</p>
          <div className="uc-how-grid">
            {[
              { n: "1", icon: <Search size={28} className="uc-how-svg" strokeWidth={1.5} />, title: "Choose Service", desc: "Pick from 10+ categories and select your preferred package" },
              { n: "2", icon: <Calendar size={28} className="uc-how-svg" strokeWidth={1.5} />, title: "Pick Date & Time", desc: "Choose a convenient slot from our available timings" },
              { n: "3", icon: <Star size={28} className="uc-how-svg" strokeWidth={1.5} />, title: "Expert at Door", desc: "A verified professional arrives and gets the job done" },
            ].map((step, i) => (
              <div key={i} className="uc-how-card">
                <div className="uc-how-number">{step.n}</div>
                <div className="uc-how-icon-wrapper">{step.icon}</div>
                <div className="uc-how-title">{step.title}</div>
                <div className="uc-how-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews */}
        {dynamicReviews && dynamicReviews.length > 0 && (
          <div className="uc-reviews-section">
            <h2 className="uc-section-title" style={{ textAlign: "center" }}>What our customers say</h2>
            <div className="uc-reviews-grid">
              {dynamicReviews.map((r, i) => (
                <motion.div key={i} className="uc-review-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <div className="uc-review-top">
                    <img src={r.avatar} alt={r.name} className="uc-review-avatar-img" />
                    <div>
                      <div className="uc-review-name">{r.name}</div>
                      <div className="uc-review-ago">{r.ago}</div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <StarRow rating={r.rating} size={14} />
                    </div>
                  </div>
                  <p className="uc-review-text">"{r.text}"</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STEP 2 — PACKAGE SELECTION
   ───────────────────────────────────────────────────────────────────────── */

function StepPackage({ category, selectedPackage, onSelect, onNext, onBack, packagesData }) {
  const rawList = (packagesData && (packagesData[category?.id] || packagesData[category?.slug] || packagesData[category?.name?.toLowerCase()])) || PACKAGES[category?.id] || PACKAGES[category?.slug] || []
  const packages = rawList.map(p => ({ ...p, priceStr: BOOKING_CURRENCY_SYMBOL + p.price }))

  return (
    <div className="uc-step-page">
      <div className="uc-step-back" onClick={onBack}><ArrowLeft size={16} /> Back</div>

      <div className="uc-step-hero-bar" style={{ background: `linear-gradient(135deg,${category?.grad?.[0]},${category?.grad?.[1]})` }}>
        <span style={{ fontSize: "2.5rem" }}>{category?.emoji}</span>
        <div>
          <div className="uc-step-hero-name">{category?.name}</div>
          <StarRow rating={category?.rating} size={13} />
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{category?.desc}</div>
        </div>
      </div>

      <h2 className="uc-step-h2">Choose your package</h2>
      <p className="uc-step-sub">Transparent pricing · No hidden charges</p>

      <div className="uc-pkg-grid">
        {packages.map(pkg => {
          const sel = selectedPackage?.id === pkg.id
          return (
            <motion.div
              key={pkg.id}
              className={`uc-pkg-card ${sel ? "uc-pkg-card--sel" : ""} ${pkg.popular ? "uc-pkg-card--pop" : ""}`}
              onClick={() => onSelect(pkg)}
              whileHover={{ y: -2 }}
              layout
            >
              {pkg.tag && (
                <div className="uc-pkg-tag" style={{ background: pkg.popular ? "#7C3AED" : "#059669" }}>
                  {pkg.popular ? "⭐ " : "✅ "}{pkg.tag}
                </div>
              )}

              {pkg.image && (
                <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', height: 140 }}>
                  <img src={pkg.image} alt={pkg.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div className="uc-pkg-top">
                <div>
                  <div className="uc-pkg-name">{pkg.name}</div>
                  <div className="uc-pkg-dur"><Clock size={12} /> {pkg.duration} service</div>
                </div>
                <div className="uc-pkg-price-col">
                  <div className="uc-pkg-price">{pkg.priceStr}</div>
                  <div className="uc-pkg-price-note">all inclusive</div>
                </div>
              </div>

              <div className="uc-pkg-divider" />

              <div className="uc-pkg-list">
                {pkg.includes.map(item => (
                  <div key={item} className="uc-pkg-item uc-pkg-yes">
                    <CheckCircle2 size={13} /> {item}
                  </div>
                ))}
                {pkg.excludes.map(item => (
                  <div key={item} className="uc-pkg-item uc-pkg-no">
                    <X size={12} /> {item}
                  </div>
                ))}
              </div>

              <div className={`uc-pkg-radio ${sel ? "uc-pkg-radio--sel" : ""}`}>
                {sel && <div className="uc-pkg-radio-dot" />}
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="uc-step-footer">
        <button className="uc-btn-primary" onClick={onNext} disabled={!selectedPackage}>
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STEP 3 — SCHEDULE
   ───────────────────────────────────────────────────────────────────────── */

const LOCAL_TIME_SLOTS = [
  { period: "Morning", icon: "🌅", slots: [{ t: "07:00", l: "7:00 AM" }, { t: "08:00", l: "8:00 AM" }, { t: "09:00", l: "9:00 AM" }, { t: "10:00", l: "10:00 AM" }, { t: "11:00", l: "11:00 AM" }] },
  { period: "Afternoon", icon: "☀️", slots: [{ t: "12:00", l: "12:00 PM" }, { t: "13:00", l: "1:00 PM" }, { t: "14:00", l: "2:00 PM" }, { t: "15:00", l: "3:00 PM" }, { t: "16:00", l: "4:00 PM" }] },
  { period: "Evening", icon: "🌆", slots: [{ t: "17:00", l: "5:00 PM" }, { t: "18:00", l: "6:00 PM" }, { t: "19:00", l: "7:00 PM" }] },
]

function StepSchedule({ category, selectedDate, selectedTime, onDateChange, onTimeChange, onNext, onBack }) {
  const dateScrollRef = useRef()
  const canContinue = selectedDate && selectedTime

  const scrollDates = (dir) => {
    if (dateScrollRef.current) {
      dateScrollRef.current.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' })
    }
  }

  return (
    <div className="uc-step-page">
      <div className="uc-step-back" onClick={onBack}><ArrowLeft size={16} /> Back</div>
      <h2 className="uc-step-h2">When should we come?</h2>
      <p className="uc-step-sub">Pick a date and time that works for you</p>

      {/* Date Scroll */}
      <div className="uc-date-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div className="uc-subsection-label" style={{ marginBottom: 0 }}><Calendar size={14} /> Select Date</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => scrollDates('left')}
              title="Scroll Left"
              style={{
                width: 30, height: 30, borderRadius: '50%', border: '1.5px solid #cbd5e1',
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#475569', transition: 'all 0.15s ease'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scrollDates('right')}
              title="Scroll Right"
              style={{
                width: 30, height: 30, borderRadius: '50%', border: '1.5px solid #cbd5e1',
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#475569', transition: 'all 0.15s ease'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="uc-date-scroll" ref={dateScrollRef}>
          {DAYS_LIST.map(d => (
            <button
              key={d.iso}
              className={`uc-date-pill ${selectedDate === d.iso ? "uc-date-pill--sel" : ""}`}
              onClick={() => onDateChange(d.iso)}
            >
              {d.today && <div className="uc-date-today-tag">Today</div>}
              <div className="uc-date-day">{d.day}</div>
              <div className="uc-date-num">{d.date}</div>
              <div className="uc-date-mon">{d.month}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Time Slots */}
      <div className="uc-time-section">
        <div className="uc-subsection-label"><Clock size={14} /> Select Time Slot</div>
        {LOCAL_TIME_SLOTS.map(group => (
          <div key={group.period} className="uc-time-group">
            <div className="uc-time-period-label">{group.icon} {group.period}</div>
            <div className="uc-time-slots">
              {group.slots.map(s => (
                <button
                  key={s.t}
                  className={`uc-time-slot ${selectedTime === s.t ? "uc-time-slot--sel" : ""}`}
                  onClick={() => onTimeChange(s.t)}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="uc-step-footer">
        <button className="uc-btn-primary" onClick={onNext} disabled={!canContinue}>
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STEP 4 — PHONE OTP IDENTITY
   ───────────────────────────────────────────────────────────────────────── */

function StepLogin({ category, onVerified, onBack }) {
  const { user, refreshMe } = useAuth()
  const [mode, setMode] = useState("phone")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState("")
  const [devCode, setDevCode] = useState("")
  const refs = [useRef(), useRef(), useRef(), useRef()]

  // Restore session
  useEffect(() => {
    if (user) {
      onVerified({
        verified: true,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.username || 'Customer'),
        phone: user.phone || '',
        email: user.email || ''
      })
      return
    }
    try {
      const s = JSON.parse(sessionStorage.getItem(OTP_SESSION_KEY) || "null")
      if (s?.verified && s?.name && s?.phone) onVerified(s)
    } catch { }
  }, [user, onVerified])

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const googleLoginHandler = useGoogleLogin({
    flow: "implicit",
    onSuccess: async (tr) => {
      setLoading(true);
      setError("");
      try {
        const res = await apiCustomerGoogleLogin(tr.access_token);
        if (res?.success) {
          await refreshMe();
          const data = {
            verified: true,
            name: res.user?.name || "",
            phone: res.user?.phone || "",
            email: res.user?.email || ""
          };
          sessionStorage.setItem(OTP_SESSION_KEY, JSON.stringify(data));
          onVerified(data);
        } else {
          setError(res?.detail || "Google login failed");
        }
      } catch (err) {
        setError(extractAuthError(err, "Google login failed"));
      } finally {
        setLoading(false);
      }
    },
    onError: (err) => {
      console.error("Google OAuth error:", err);
      setError(err?.error_description || err?.error || "Google login failed");
    }
  });

  const nameOk = name.trim().length >= 2
  const phoneOk = phone.replace(/[\s\-\(\)\+]/g, "").length >= 7

  const sendOtp = async () => {
    if (!nameOk || !phoneOk) return
    setLoading(true); setError(""); setDevCode("")
    try {
      const res = await apiRequest("/auth/send-otp/", { method: "POST", json: { phone } })
      if (res?.success) {
        setMode("otp"); setCooldown(30)
        if (res.code) {
          const digits = String(res.code).split("")
          setOtp(digits); setDevCode(String(res.code))
          setTimeout(() => refs[3]?.current?.focus(), 100)
        }
      } else setError(res?.detail || res?.message || "Failed to send OTP")
    } catch (e) { setError(e?.body?.detail || "Could not send OTP") }
    finally { setLoading(false) }
  }

  const verifyOtp = async () => {
    const code = otp.join("")
    if (code.length < 4) { setError("Enter all 4 digits"); return }
    setLoading(true); setError("")
    try {
      const res = await apiRequest("/auth/verify-otp/", { method: "POST", json: { phone, code } })
      if (res?.success) {
        await refreshMe()
        const data = { verified: true, name: name.trim(), phone, email: email.trim() }
        sessionStorage.setItem(OTP_SESSION_KEY, JSON.stringify(data))
        setMode("done")
        setTimeout(() => onVerified(data), 700)
      } else setError(res?.detail || "Invalid code")
    } catch (e) { setError(e?.body?.detail || "Verification failed") }
    finally { setLoading(false) }
  }

  const handleDigit = (i, val) => {
    const d = val.replace(/\D/g, "").slice(-1)
    const next = [...otp]; next[i] = d; setOtp(next)
    if (d && i < 3) refs[i + 1]?.current?.focus()
  }
  const handleKey = (i, e) => { if (e.key === "Backspace" && !otp[i] && i > 0) refs[i - 1]?.current?.focus() }
  const handlePaste = e => {
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4)
    if (p.length === 4) { setOtp(p.split("")); refs[3]?.current?.focus() }
  }

  return (
    <div className="uc-step-page uc-login-page">
      <div className="uc-step-back" onClick={onBack}><ArrowLeft size={16} /> Back</div>

      {/* PHONE MODE */}
      {mode === "phone" && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="uc-login-center">
            <div className="uc-login-shield">
              <ShieldCheck size={32} style={{ color: "#7C3AED" }} />
            </div>
            <h2 className="uc-step-h2">Verify your identity</h2>
            <p className="uc-step-sub">We'll send a 4-digit OTP to confirm your phone number before booking</p>
          </div>

          <div className="uc-login-trust-row">
            <span><Shield size={11} /> SSL Secured</span>
            <span><Lock size={11} /> No password needed</span>
            <span><ShieldCheck size={11} /> 5 min OTP expiry</span>
          </div>

          <div className="uc-form">
            <div className="uc-field">
              <label className="uc-label">Full Name <span style={{ color: "#ef4444" }}>*</span></label>
              <div className="uc-input-wrap">
                <User size={15} className="uc-field-icon" />
                <input className="uc-input" placeholder="Enter your full name" value={name} onChange={e => setName(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="uc-field">
              <label className="uc-label">Mobile Number <span style={{ color: "#ef4444" }}>*</span></label>
              <div className="uc-input-wrap">
                <Phone size={15} className="uc-field-icon" />
                <input className="uc-input" placeholder="+91 9876 543 210" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && nameOk && phoneOk && sendOtp()}
                />
              </div>
            </div>
            <div className="uc-field">
              <label className="uc-label">Email <span style={{ color: "#94a3b8", fontWeight: 500 }}>(optional)</span></label>
              <div className="uc-input-wrap">
                <Mail size={15} className="uc-field-icon" />
                <input className="uc-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
          </div>

          {error && <div className="uc-error"><AlertCircle size={13} /> {error}</div>}

          <button className="uc-btn-primary uc-btn-full" onClick={sendOtp} disabled={!nameOk || !phoneOk || loading}>
            {loading ? <><RefreshCw size={15} className="spin-icon" /> Sending…</> : <><MessageSquare size={15} /> Send OTP</>}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div style={{ flex: 1, height: 1, background: '#cbd5e1' }} />
            <span style={{ padding: '0 10px' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#cbd5e1' }} />
          </div>

          <button
            type="button"
            onClick={() => googleLoginHandler()}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'white',
              color: '#1e293b',
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              opacity: loading ? 0.7 : 1
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.8 2.17c1.64-1.51 2.59-3.74 2.59-6.5z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.8-2.17c-.78.52-1.78.83-2.8.83-2.34 0-4.32-1.58-5.03-3.7L1.47 13.07C2.95 16 6.01 18 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.78c-.18-.52-.28-1.09-.28-1.68s.1-1.16.28-1.68L1.47 5.12C.53 7 0 9.08 0 11.2s.53 4.2 1.47 6.08l2.5-1.9c-.71-2.12-.71-4.4 0-6.5z" />
              <path fill="#EA4335" d="M9 3.58c1.32-.03 2.59.48 3.51 1.4l2.63-2.63C13.48.88 11.3.02 9 0 6.01 0 2.95 2 1.47 4.93l2.5 1.9C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>
        </motion.div>
      )}

      {/* OTP MODE */}
      {mode === "otp" && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
          <div className="uc-login-center">
            <div className="uc-login-shield" style={{ background: "#ecfdf520" }}>
              <KeyRound size={32} style={{ color: "#10B981" }} />
            </div>
            <h2 className="uc-step-h2">Enter OTP</h2>
            <p className="uc-step-sub">
              4-digit code sent to <strong>{phone}</strong> &nbsp;
              <button className="uc-link" onClick={() => { setMode("phone"); setOtp(["", "", "", ""]); setError("") }}>Change</button>
            </p>
          </div>

          {devCode && (
            <div className="uc-dev-banner">
              <Zap size={13} /> Dev mode — code: <strong>{devCode}</strong> (auto-filled)
            </div>
          )}

          <div className="uc-otp-row" onPaste={handlePaste}>
            {otp.map((d, i) => (
              <input key={i} ref={refs[i]}
                className={`uc-otp-box ${d ? "uc-otp-filled" : ""}`}
                value={d} maxLength={1} inputMode="numeric"
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKey(i, e)}
              />
            ))}
          </div>

          {error && <div className="uc-error"><AlertCircle size={13} /> {error}</div>}

          <button className="uc-btn-primary uc-btn-full" onClick={verifyOtp} disabled={otp.join("").length < 4 || loading}>
            {loading ? <><RefreshCw size={15} className="spin-icon" /> Verifying…</> : <><ShieldCheck size={15} /> Verify &amp; Continue</>}
          </button>

          <div className="uc-resend">
            {cooldown > 0
              ? <span style={{ color: "#94a3b8", fontSize: "0.78rem", fontWeight: 600 }}>Resend in {cooldown}s</span>
              : <button className="uc-link" onClick={sendOtp} disabled={loading}>Resend OTP</button>
            }
          </div>
        </motion.div>
      )}

      {/* SUCCESS */}
      {mode === "done" && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="uc-login-success">
          <motion.div className="uc-success-check" animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: 2, duration: 0.4 }}>
            <CheckCircle2 size={48} style={{ color: "#10B981" }} />
          </motion.div>
          <div className="uc-success-title">Identity Verified!</div>
          <div className="uc-success-sub">Welcome, {name} ðŸ‘‹</div>
          <div className="uc-success-sub" style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Loading your booking form…</div>
        </motion.div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STEP 5 — CUSTOMER DETAILS
   ───────────────────────────────────────────────────────────────────────── */

function StepDetails({ category, cart, formData, onChange, photoFile, onPhotoChange, photoPreview, onNext, onBack, globalLocation, onOpenMap }) {
  const fileRef = useRef()
  const { user } = useAuth()
  const phoneClean = (formData.phone || "").replace(/[\s\-\(\)\+]/g, "")
  const phoneValid = phoneClean.length >= 7 && /^\d+$/.test(phoneClean)
  const ok = formData.customer_name && phoneValid && formData.address && formData.issue_title

  useEffect(() => {
    if (globalLocation && !formData.address) {
      onChange({ target: { name: 'address', value: globalLocation } })
    }
  }, [globalLocation, formData.address])

  useEffect(() => {
    if (!formData.issue_title && cart && cart.length > 0) {
      const defaultTitle = cart.map(c => c.name).join(', ') + (category ? ` — ${category.name}` : '');
      onChange({ target: { name: 'issue_title', value: defaultTitle } })
    }
  }, [cart, category, formData.issue_title])

  useEffect(() => {
    if (user) {
      if (!formData.customer_name && user.firstName) {
        onChange({ target: { name: 'customer_name', value: `${user.firstName} ${user.lastName || ''}`.trim() } })
      }
      if (!formData.phone && user.phone) {
        onChange({ target: { name: 'phone', value: user.phone } })
      }
      if (!formData.email && user.email) {
        onChange({ target: { name: 'email', value: user.email } })
      }
    }
  }, [user, formData.customer_name, formData.phone, formData.email])

  return (
    <div className="uc-step-page">
      <div className="uc-step-back" onClick={onBack}><ArrowLeft size={16} /> Back</div>
      <h2 className="uc-step-h2">Service details</h2>
      <p className="uc-step-sub">Tell us where to send our expert and describe the issue</p>

      <div className="uc-form">
        <div className="uc-field-row">
          <div className="uc-field">
            <label className="uc-label">Full Name <span style={{ color: "#ef4444" }}>*</span></label>
            <div className="uc-input-wrap">
              <User size={15} className="uc-field-icon" />
              <input className="uc-input" name="customer_name" placeholder="Your full name" value={formData.customer_name} onChange={onChange} />
            </div>
          </div>
          <div className="uc-field">
            <label className="uc-label">Mobile Number <span style={{ color: "#ef4444" }}>*</span></label>
            <div className="uc-input-wrap">
              <Phone size={15} className="uc-field-icon" />
              <input className="uc-input" name="phone" placeholder="+91 9876 543 210" value={formData.phone} onChange={onChange} />
            </div>
          </div>
        </div>

        <div className="uc-field">
          <label className="uc-label">Email Address</label>
          <div className="uc-input-wrap">
            <Mail size={15} className="uc-field-icon" />
            <input className="uc-input" name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={onChange} />
          </div>
        </div>

        <div className="uc-field">
          <label className="uc-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Full Address <span style={{ color: "#ef4444" }}>*</span></span>
            <span onClick={onOpenMap} style={{ color: '#7C3AED', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> Pick on Map</span>
          </label>
          <div className="uc-input-wrap" onClick={onOpenMap} style={{ cursor: 'pointer' }}>
            <MapPin size={15} className="uc-field-icon" />
            <input className="uc-input" name="address" placeholder="Tap to pick location from map..." value={formData.address} readOnly style={{ cursor: 'pointer' }} />
          </div>
        </div>

        <div className="uc-field">
          <label className="uc-label">House/Flat No, Landmark (optional)</label>
          <div className="uc-input-wrap">
            <Home size={15} className="uc-field-icon" />
            <input className="uc-input" name="landmark" placeholder="e.g. Flat 402, Near Metro Station" value={formData.landmark || ""} onChange={onChange} />
          </div>
        </div>

        <div className="uc-field">
          <label className="uc-label">Issue Title <span style={{ color: "#ef4444" }}>*</span></label>
          <div className="uc-input-wrap">
            <FileText size={15} className="uc-field-icon" />
            <input className="uc-input" name="issue_title" placeholder={`e.g. ${category?.name} - brief description`} value={formData.issue_title} onChange={onChange} />
          </div>
        </div>

        <div className="uc-field">
          <label className="uc-label">Describe the problem (optional)</label>
          <textarea
            className="uc-textarea"
            name="description"
            rows={3}
            placeholder="Any specific issues, brand of appliance, how long the problem has been occurring…"
            value={formData.description}
            onChange={onChange}
          />
        </div>

        {/* Photo Upload */}
        <div className="uc-field">
          <label className="uc-label">Attach a photo (optional)</label>
          <div
            className="uc-photo-zone"
            onClick={() => fileRef.current?.click()}
          >
            {photoPreview ? (
              <div className="uc-photo-preview">
                <img src={photoPreview} alt="preview" />
                <div className="uc-photo-change"><Camera size={14} /> Change photo</div>
              </div>
            ) : (
              <>
                <Camera size={24} style={{ color: "#94a3b8" }} />
                <div className="uc-photo-text">Click to attach a photo of the issue</div>
                <div className="uc-photo-hint">JPG, PNG — helps our expert prepare</div>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhotoChange} />
          </div>
        </div>
      </div>

      <div className="uc-step-footer">
        <button className="uc-btn-primary" onClick={onNext} disabled={!ok}>
          Review Booking <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STEP 6 — CONFIRM
   ───────────────────────────────────────────────────────────────────────── */

function StepConfirm({ category, pkg, cart, date, time, formData, photoPreview, onBack, onSubmit, loading, error }) {
  const [agreed, setAgreed] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const displayDate = date ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : ""
  const displayTime = time ? TIME_SLOTS.flatMap(g => g.slots).find(s => s.t === time)?.l : ""
  const totalPrice = cart && cart.length > 0 ? cart.reduce((a, c) => a + (c.price * c.quantity), 0) : (pkg?.price || 0)

  // Gather service/package info
  const serviceItems = cart && cart.length > 0 ? cart : (pkg ? [pkg] : [])
  const totalDuration = serviceItems.reduce((a, c) => {
    const match = (c.duration || "").match(/(\d+)/)
    return a + (match ? parseInt(match[1]) : 0)
  }, 0)
  const techCount = Math.ceil(totalDuration / 4) || 1

  return (
    <div className="uc-step-page">
      <div className="uc-step-back" onClick={onBack}><ArrowLeft size={16} /> Back</div>
      <h2 className="uc-step-h2">Review & confirm</h2>
      <p className="uc-step-sub">Check all the details before booking</p>

      <div className="uc-confirm-layout">
        {/* Summary Card */}
        <div className="uc-summary-card">
          <div className="uc-summary-hero" style={{ background: `linear-gradient(135deg,#7C3AED,#a855f7)` }}>
            <span style={{ fontSize: "2rem" }}>{category?.emoji || "🔧"}</span>
            <div>
              <div style={{ fontWeight: 800, color: "white", fontSize: "1rem" }}>{category?.name || "Service"}</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.75rem" }}>
                {cart && cart.length > 0 ? `${cart.reduce((a, c) => a + c.quantity, 0)} Item${cart.reduce((a, c) => a + c.quantity, 0) > 1 ? 's' : ''} Selected` : pkg?.name}
              </div>
            </div>
          </div>

          {/* Service/Package detail chips */}
          <div style={{ padding: "0.85rem 1rem", background: "#f8fafc", display: "flex", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #e2e8f0" }}>
            {serviceItems.slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: "white", border: "1px solid #e2e8f0", borderRadius: 99, padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700, color: "#1e293b" }}>
                <CheckCircle2 size={11} color="#10B981" />{item.name}
              </div>
            ))}
            {serviceItems.length > 3 && <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#7C3AED", padding: "4px 10px" }}>+{serviceItems.length - 3} more</div>}
          </div>

          {/* Key stats row */}
          <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
            {[
              { icon: <Clock size={13} />, label: "Duration", value: totalDuration > 0 ? `${totalDuration} Hr${totalDuration > 1 ? 's' : ''}` : (serviceItems[0]?.duration || "As needed") },
              { icon: <Users size={13} />, label: "Technicians", value: `${techCount} Pro${techCount > 1 ? 's' : ''}` },
              { icon: <Award size={13} />, label: "Guarantee", value: "30-Day" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: "0.75rem", textAlign: "center", borderRight: i < 2 ? "1px solid #e2e8f0" : "none" }}>
                <div style={{ display: "flex", justifyContent: "center", color: "#7C3AED", marginBottom: 3 }}>{s.icon}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 900, color: "#0f172a" }}>{s.value}</div>
                <div style={{ fontSize: "0.62rem", color: "#94a3b8", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="uc-summary-body">
            <div className="uc-summary-row"><Calendar size={14} /> <span>{displayDate || date}</span></div>
            <div className="uc-summary-row"><Clock size={14} /> <span>{displayTime || time}</span></div>
            <div className="uc-summary-row"><User size={14} /> <span>{formData.customer_name}</span></div>
            <div className="uc-summary-row"><Phone size={14} /> <span>{formData.phone}</span></div>
            <div className="uc-summary-row"><MapPin size={14} /> <span>{formData.address}</span></div>
            {photoPreview && (
              <div style={{ marginTop: "0.75rem" }}>
                <img src={photoPreview} alt="Issue" style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 120 }} />
              </div>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="uc-price-box">
            {cart && cart.length > 0 ? (
              cart.map((c, i) => (
                <div key={i} className="uc-price-row">
                  <span>{c.quantity}x {c.name}</span>
                  <span>{BOOKING_CURRENCY_SYMBOL}{c.price * c.quantity}</span>
                </div>
              ))
            ) : (
              <div className="uc-price-row">
                <span>{pkg?.name}</span>
                <span>{pkg?.priceStr}</span>
              </div>
            )}
            <div className="uc-price-row uc-price-free">
              <span>Platform fee</span>
              <span style={{ color: "#10B981", fontWeight: 700 }}>FREE</span>
            </div>
            <div className="uc-price-row uc-price-free">
              <span>Travel charges</span>
              <span style={{ color: "#10B981", fontWeight: 700 }}>FREE</span>
            </div>
            <div className="uc-price-total">
              <span>Total</span>
              <span>{BOOKING_CURRENCY_SYMBOL}{totalPrice}</span>
            </div>
            <div style={{ textAlign: "center", fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.25rem" }}>
              Pay at doorstep · No advance required
            </div>
          </div>
        </div>

        {/* Includes */}
        <div className="uc-confirm-includes">
          <div className="uc-includes-title">What's included</div>
          {cart && cart.length > 0 ? (
            cart.flatMap(c => c.includes).filter((v, i, a) => a.indexOf(v) === i).map((item, i) => (
              <div key={i} className="uc-includes-row">
                <CheckCircle2 size={14} style={{ color: "#10B981", flexShrink: 0 }} />
                <span>{item}</span>
              </div>
            ))
          ) : (
            pkg?.includes?.map(item => (
              <div key={item} className="uc-includes-row">
                <CheckCircle2 size={14} style={{ color: "#10B981", flexShrink: 0 }} />
                <span>{item}</span>
              </div>
            ))
          )}

          <div className="uc-guarantee-box">
            <Award size={18} style={{ color: "#7C3AED" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "#1e293b" }}>30-Day Quality Guarantee</div>
              <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Free re-service if you're not satisfied</div>
            </div>
          </div>

          <label className="uc-agree">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ accentColor: "#7C3AED" }} />
            <span>I agree to the <a href="#" className="uc-link">Terms of Service</a> and <a href="#" className="uc-link">Privacy Policy</a></span>
          </label>

          {error && <div className="uc-error"><AlertCircle size={13} /> {error}</div>}

          <button
            className="uc-btn-primary uc-btn-full"
            onClick={() => { if (agreed && !loading) setShowPayment(true) }}
            disabled={!agreed || loading}
          >
            {loading ? <><RefreshCw size={16} className="spin-icon" /> Processing…</> : <><CreditCard size={16} /> Choose Payment & Confirm</>}
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.7rem", color: "#94a3b8" }}>
            <Shield size={12} /> Secured & encrypted · Pay on arrival
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPayment && (
          <PaymentModal
            total={totalPrice}
            allowedMethods={cart.some(c => c.payment_policy === 'ONLINE_ONLY') ? ['online'] : ['cash', 'online']}
            onClose={() => setShowPayment(false)}
            onConfirm={(method) => { setShowPayment(false); onSubmit(method) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   PAYMENT MODAL
   ───────────────────────────────────────────────────────────────────────── */

function PaymentModal({ total, allowedMethods = ['cash', 'online'], onClose, onConfirm, bookingId }) {
  const [selected, setSelected] = useState(allowedMethods.includes('online') && allowedMethods.length === 1 ? 'online' : 'cash')
  const [confirming, setConfirming] = useState(false)
  const [showOnlineSheet, setShowOnlineSheet] = useState(false)
  const [payTab, setPayTab] = useState('upi')
  const [upiId, setUpiId] = useState('')
  const [cardNum, setCardNum] = useState('')
  const [cardName, setCardName] = useState('')
  const [cardExp, setCardExp] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [payPhase, setPayPhase] = useState(null) // null | 'processing' | 'success' | 'failed'
  const [payError, setPayError] = useState('')

  const handleConfirm = async () => {
    if (selected === 'online') {
      setShowOnlineSheet(true)
    } else {
      setConfirming(true)
      await new Promise(r => setTimeout(r, 400))
      onConfirm('cash')
    }
  }

  const handleOnlinePayment = async () => {
    setPayPhase('processing')
    setPayError('')
    await new Promise(r => setTimeout(r, 2200))
    const success = Math.random() > 0.05
    if (success) {
      setPayPhase('success')
      if (bookingId) {
        try {
          await apiRequest('/payment/verify/', {
            method: 'POST',
            json: { booking_id: bookingId, order_id: `order_mock_${Date.now()}`, payment_id: `PAY_${Date.now().toString(36).toUpperCase()}`, mock_success: true }
          })
        } catch (e) { /* non-critical */ }
      }
      await new Promise(r => setTimeout(r, 1200))
      onConfirm('online')
    } else {
      setPayPhase('failed')
      setPayError('Payment failed. Please check your details and try again.')
    }
  }

  const options = [
    { id: "cash", icon: <CreditCard size={24} color="#10B981" />, label: "Cash on Service", sub: "Pay after service is completed", badge: "Most Popular", badgeColor: "#10B981", detail: ["No upfront payment", "Pay only on completion", "Any denomination accepted"] },
    { id: "online", icon: <Wallet size={24} color="#7C3AED" />, label: "Pay via UPI", sub: "Google Pay, PhonePe, Paytm, BHIM", badge: "Instant", badgeColor: "#7C3AED", detail: ["100% secure & encrypted", "Instant confirmation", "Invoice emailed immediately"] },
  ].filter(o => allowedMethods.includes(o.id))

  if (showOnlineSheet) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10020, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <motion.div initial={{ y: 400, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          style={{ background: 'white', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 540, paddingBottom: '2rem' }}>
          <div style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', borderRadius: '28px 28px 0 0', padding: '1.5rem 1.75rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Secure UPI Payment</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', marginTop: 2 }}>{BOOKING_CURRENCY_SYMBOL}{total.toLocaleString()}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Lock size={11} /> SSL Secured
              </div>
            </div>
          </div>
          <div style={{ padding: '1.5rem 1.75rem' }}>
            {payPhase === 'processing' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: '1.5rem' }}><RefreshCw size={48} color="#7C3AED" /></motion.div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Processing UPI Payment…</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Please do not close this window</div>
              </div>
            )}
            {payPhase === 'success' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#10B981,#34D399)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <Check size={36} color="white" />
                </motion.div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Payment Successful! 🎉</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Your booking is now confirmed</div>
                <div style={{ marginTop: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>✅ Amount {BOOKING_CURRENCY_SYMBOL}{total.toLocaleString()} debited successfully</div>
              </div>
            )}
            {payPhase === 'failed' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', border: '2px solid #FECACA' }}><X size={36} color="#EF4444" /></div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Payment Failed</div>
                <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: '1.25rem' }}>{payError}</div>
                <button onClick={() => setPayPhase(null)} style={{ padding: '0.75rem 2rem', background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', color: 'white', fontWeight: 800, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Try Again</button>
              </div>
            )}
            {payPhase === null && (
              <>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Enter UPI ID</label>
                <div style={{ display: 'flex', alignItems: 'center', border: `2px solid ${upiId ? '#7C3AED' : '#e2e8f0'}`, borderRadius: 12, overflow: 'hidden', marginBottom: '0.75rem' }}>
                  <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi"
                    style={{ flex: 1, border: 'none', outline: 'none', padding: '0.9rem 1rem', fontSize: '0.95rem', color: '#0f172a' }} />
                  <div style={{ padding: '0 1rem', color: '#7C3AED', fontWeight: 800, fontSize: '0.75rem' }}>VERIFY</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                  {['PhonePe', 'GPay', 'Paytm', 'BHIM'].map(app => (
                    <button key={app} onClick={() => setUpiId(app.toLowerCase() + '@ybl')}
                      style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: 'white', color: '#374151' }}>{app}</button>
                  ))}
                </div>
                <button onClick={handleOnlinePayment} disabled={!upiId}
                  style={{ width: '100%', padding: '1rem', background: upiId ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : '#e2e8f0', color: upiId ? 'white' : '#94a3b8', fontWeight: 800, fontSize: '0.95rem', border: 'none', borderRadius: 14, cursor: upiId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Lock size={15} /> Pay {BOOKING_CURRENCY_SYMBOL}{total.toLocaleString()}
                </button>
              </>
            )}
            {payPhase === null && (
              <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Shield size={11} /> 256-bit SSL · UPI Encryption
              </div>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 10010, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <motion.div initial={{ y: 300, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 300, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }} onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 540, paddingBottom: '2.25rem', overflow: 'hidden', boxShadow: '0 -20px 50px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '1.5rem 1.75rem 0', position: 'relative' }}>
          <div style={{ width: 40, height: 4, background: '#cbd5e1', borderRadius: 99, margin: '0 auto 1.25rem' }} />

          <button onClick={onClose} style={{ position: 'absolute', right: 24, top: 20, width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>

          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Choose Payment Method</h3>
          <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Total: <strong style={{ color: '#7C3AED', fontSize: '1.1rem', fontWeight: 900 }}>{BOOKING_CURRENCY_SYMBOL}{total.toLocaleString()}</strong></p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0 1.75rem', marginBottom: '1.5rem' }}>
          {options.map(opt => {
            const isSel = selected === opt.id
            const themeColor = opt.id === 'cash' ? '#10B981' : '#7C3AED'
            const activeBg = opt.id === 'cash' ? '#f0fdf4' : '#faf5ff'
            const iconBg = opt.id === 'cash' ? '#10B98118' : '#7C3AED18'
            const shadowColor = opt.id === 'cash' ? 'rgba(16,185,129,0.15)' : 'rgba(124,58,237,0.15)'

            return (
              <div key={opt.id} onClick={() => setSelected(opt.id)}
                style={{
                  border: `2px solid ${isSel ? themeColor : '#e2e8f0'}`,
                  borderRadius: 18,
                  padding: '1.1rem 1.2rem',
                  cursor: 'pointer',
                  background: isSel ? activeBg : 'white',
                  transition: 'all 0.2s ease',
                  boxShadow: isSel ? `0 8px 24px ${shadowColor}` : '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: isSel ? iconBg : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${isSel ? themeColor + '30' : '#e2e8f0'}` }}>
                    {opt.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {opt.label}
                      <span style={{ background: opt.badgeColor + '18', color: opt.badgeColor, fontSize: '0.62rem', fontWeight: 800, padding: '2px 9px', borderRadius: 99, border: `1px solid ${opt.badgeColor}30`, letterSpacing: '0.02em' }}>
                        {opt.badge}
                      </span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4, fontWeight: 500 }}>{opt.sub}</div>

                    {isSel && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                        style={{
                          marginTop: '0.85rem',
                          paddingTop: '0.75rem',
                          borderTop: `1px dashed ${themeColor}35`,
                        }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                          {opt.detail.map((d, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              fontSize: '0.74rem', color: opt.id === 'cash' ? '#065f46' : '#5b21b6',
                              fontWeight: 700, background: opt.id === 'cash' ? '#d1fae5' : '#ede9fe',
                              padding: '4px 10px', borderRadius: 8, border: `1px solid ${themeColor}30`
                            }}>
                              <CheckCircle2 size={13} color={themeColor} /> {d}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSel ? themeColor : '#cbd5e1'}`, background: isSel ? themeColor : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    {isSel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '0 1.75rem' }}>
          <button onClick={handleConfirm} disabled={confirming}
            style={{
              width: '100%', padding: '1rem',
              background: selected === 'cash' ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
              color: 'white', fontWeight: 900, fontSize: '1rem', border: 'none', borderRadius: 16,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: selected === 'cash' ? '0 6px 20px rgba(16,185,129,0.35)' : '0 6px 20px rgba(124,58,237,0.35)',
              transition: 'all 0.2s ease'
            }}>
            {confirming ? <><RefreshCw size={18} className="spin-icon" /> Processing...</> :
              selected === 'online' ? <><Lock size={18} /> Continue to Pay {BOOKING_CURRENCY_SYMBOL}{total.toLocaleString()}</> :
                <><CheckCheck size={18} /> Confirm & Book Service</>}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.85rem', fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontWeight: 600 }}>
            <Shield size={12} color="#10B981" /> 256-bit SSL encrypted · Your info is safe
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   POST-BOOKING ANIMATED FLOW
   ───────────────────────────────────────────────────────────────────────── */

function PostBookingFlow({ bookingData, category, cart, formData, selDate, selTime, onDone }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1500),
      setTimeout(() => setPhase(2), 3500),
      setTimeout(() => setPhase(3), 5500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const phases = [
    {
      icon: <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={52} color="#7C3AED" /></motion.div>,
      title: "Creating your booking…",
      sub: "Submitting your service request securely",
    },
    {
      icon: <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}><Users size={52} color="#F59E0B" /></motion.div>,
      title: "Finding your expert…",
      sub: "Matching you with the best professional nearby",
    },
    {
      icon: <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}><CheckCircle2 size={52} color="#10B981" /></motion.div>,
      title: "Professional Assigned! ✅",
      sub: "Your expert is confirmed and on their way",
    },
    {
      icon: <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}><span style={{ fontSize: '3.5rem' }}>🎉</span></motion.div>,
      title: "Booking Confirmed!",
      sub: "Your booking is all set. Tap below to track.",
    },
  ]

  const cur = phases[phase]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.92)', zIndex: 10005, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '2rem' }}>
      {/* Step tracker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '3rem' }}>
        {['Booking Created', 'Searching', 'Assigned', 'Confirmed'].map((label, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: i <= phase ? (i < phase ? '#10B981' : '#7C3AED') : 'rgba(255,255,255,0.15)', border: `2px solid ${i <= phase ? (i < phase ? '#10B981' : '#7C3AED') : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s' }}>
                {i < phase ? <Check size={16} color="white" /> : <span style={{ fontSize: '0.75rem', fontWeight: 800, color: i <= phase ? 'white' : 'rgba(255,255,255,0.4)' }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: i <= phase ? 'white' : 'rgba(255,255,255,0.35)', maxWidth: 60, textAlign: 'center' }}>{label}</span>
            </div>
            {i < 3 && <div style={{ width: 40, height: 2, background: i < phase ? '#10B981' : 'rgba(255,255,255,0.15)', transition: 'background 0.5s', marginBottom: 22, flexShrink: 0 }} />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.4 }}
          style={{ background: 'white', borderRadius: 24, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 360, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}
        >
          <div style={{ marginBottom: '1.25rem' }}>{cur.icon}</div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>{cur.title}</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{cur.sub}</p>

          {phase === 3 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              onClick={() => onDone(null)}
              style={{ marginTop: '1.5rem', width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', fontWeight: 800, fontSize: '0.95rem', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <MapPin size={16} /> Track My Booking
            </motion.button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   LIVE TRACKING PAGE
   ───────────────────────────────────────────────────────────────────────── */

function LiveTrackingPage({ successData, technician, category, cart, formData, selDate, selTime, onBookAgain }) {
  const rid = successData?.request_id || successData?.id || "BK" + Date.now().toString().slice(-6)
  const [etaMinutes, setEtaMinutes] = useState(25)
  const totalPrice = cart ? cart.reduce((a, c) => a + (c.price * c.quantity), 0) : (successData?.estimated_cost || 0)
  const displayDate = selDate ? new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : (successData?.scheduled_date || "Today")
  const displayTime = selTime ? LOCAL_TIME_SLOTS.flatMap(g => g.slots).find(s => s.t === selTime)?.l : (successData?.time_slot || "Upcoming")

  const tech = technician || successData?.technician || null

  const trackSteps = [
    { label: "Booking Confirmed", icon: <CheckCircle2 size={16} color="#10B981" />, done: true, time: "Just now" },
    { label: "Expert Assigned", icon: <User size={16} color="#7C3AED" />, done: !!tech, time: tech ? "Assigned" : "Pending" },
    { label: "Expert On The Way", icon: <MapPin size={16} color="#64748b" />, done: false, time: "Pending" },
    { label: "Service In Progress", icon: <Clock size={16} color="#64748b" />, done: false, time: "Scheduled" },
    { label: "Service Completed", icon: <Award size={16} color="#64748b" />, done: false, time: "Pending" },
  ]

  useEffect(() => {
    if (etaMinutes <= 0) return
    const t = setInterval(() => setEtaMinutes(m => m > 0 ? m - 1 : 0), 60000)
    return () => clearInterval(t)
  }, [etaMinutes])

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}
        >
          <CheckCircle2 size={44} color="white" />
        </motion.div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>Booking Confirmed! 🎉</h2>
        <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontSize: '0.9rem' }}>{tech ? `${tech.name} has been assigned` : "Your request is registered & being assigned"}</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f5f3ff', border: '1px solid #7C3AED30', borderRadius: 99, padding: '6px 16px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>Booking Ref</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>#{rid}</span>
        </div>
      </div>

      {/* Technician Info or Assignment in Progress Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}
      >
        {tech ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <img src={tech.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"} alt={tech.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7C3AED30' }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: '#10B981', border: '2px solid white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '1.05rem' }}>{tech.name}</div>
                {tech.rating && <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>⭐  {tech.rating} · {tech.jobs || '50+'} jobs completed</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <span style={{ background: '#10B98112', color: '#10B981', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, border: '1px solid #10B98125' }}>Verified Pro</span>
                  <span style={{ background: '#7C3AED12', color: '#7C3AED', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, border: '1px solid #7C3AED25' }}>Background Checked</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', borderRadius: 12, padding: '0.6rem 1rem', color: 'white' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{etaMinutes}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>MIN ETA</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => alert(`Calling ${tech.name}...`)}
                style={{ flex: 1, padding: '0.7rem', background: '#7C3AED', color: 'white', fontWeight: 700, fontSize: '0.85rem', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Phone size={15} /> Call Expert
              </button>
              <button onClick={() => alert("Chat feature coming soon!")}
                style={{ flex: 1, padding: '0.7rem', background: '#f1f5f9', color: '#0f172a', fontWeight: 700, fontSize: '0.85rem', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <MessageSquare size={15} /> Chat
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.35rem 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#7C3AED12', border: '1.5px solid #7C3AED25', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RefreshCw size={26} color="#7C3AED" className="spin-icon" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, color: '#0f172a', fontSize: '1rem' }}>Matching Expert</span>
                <span style={{ background: '#7C3AED15', color: '#7C3AED', fontSize: '0.65rem', fontWeight: 800, padding: '2px 9px', borderRadius: 99, border: '1px solid #7C3AED30' }}>
                  Assignment Pending
                </span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.45 }}>
                Admin is finding the best verified technician in your area. You will receive notification details shortly.
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Booking Details Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}
      >
        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} color="#7C3AED" /> Booking Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.8rem' }}>
          {[
            { label: 'Service', value: category?.name || cart?.[0]?.name },
            { label: 'Date', value: displayDate },
            { label: 'Time', value: displayTime },
            { label: 'Address', value: formData?.address || formData?.location, span: true },
            { label: 'Total Amount', value: `${BOOKING_CURRENCY_SYMBOL}${totalPrice}`, highlight: true },
          ].map((r, i) => (
            <div key={i} style={{ ...(r.span ? { gridColumn: '1/-1' } : {}), background: '#f8fafc', borderRadius: 10, padding: '0.5rem 0.75rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>{r.label}</div>
              <div style={{ fontWeight: 700, color: r.highlight ? '#7C3AED' : '#0f172a', marginTop: 2 }}>{r.value || '—'}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Live Tracking Timeline Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}
      >
        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={16} color="#7C3AED" /> Live Tracking
        </div>
        {trackSteps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.5rem 0', position: 'relative' }}>
            {i < trackSteps.length - 1 && <div style={{ position: 'absolute', left: 18, top: 36, width: 2, height: 24, background: s.done ? '#10B981' : '#e2e8f0' }} />}
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.done ? '#10B98115' : '#f8fafc', border: `2px solid ${s.done ? '#10B981' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>
              {s.done ? <Check size={16} color="#10B981" /> : s.icon}
            </div>
            <div style={{ flex: 1, paddingTop: 6 }}>
              <div style={{ fontWeight: 700, color: s.done ? '#0f172a' : '#94a3b8', fontSize: '0.85rem' }}>{s.label}</div>
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: s.done ? '#10B981' : '#94a3b8', paddingTop: 8 }}>{s.time}</div>
          </div>
        ))}
      </motion.div>

      <button onClick={onBookAgain}
        style={{ width: '100%', padding: '1rem', background: '#f1f5f9', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Home size={16} /> Book Another Service
      </button>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STEP INDICATOR BAR
   ───────────────────────────────────────────────────────────────────────── */

const STEP_LABELS = ["Service", "Package", "Schedule", "Identity", "Details", "Confirm"]

function StepBar({ step, total }) {
  return (
    <div className="uc-stepbar">
      {STEP_LABELS.slice(0, total).map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <React.Fragment key={label}>
            <div className={`uc-sb-step ${done ? "uc-sb-done" : ""} ${active ? "uc-sb-active" : ""}`}>
              <div className="uc-sb-dot">
                {done ? <Check size={10} /> : n}
              </div>
              <span className="uc-sb-label">{label}</span>
            </div>
            {i < total - 1 && <div className={`uc-sb-line ${done ? "uc-sb-line-done" : ""}`} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────
   CUSTOMER ACCOUNT MODAL
   ───────────────────────────────────────────────────────────────────────── */

function CustomerAccountModal({ activeTab, onClose, onChangeTab }) {
  const { user, refreshMe, loginWithGoogle, loginWithCustomerGoogle } = useAuth()

  const [loginMethod, setLoginMethod] = useState('email')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPhone, setLoginPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const handleRequestOTP = async () => {
    setLoginError('')
    setLoginLoading(true)
    try {
      if (loginMethod === 'email') await apiRequestCustomerEmailOTP(loginEmail)
      else await apiRequestCustomerPhoneOTP(loginPhone)
      setOtpSent(true)
    } catch (e) {
      setLoginError(e.body?.detail || 'Failed to send OTP')
    }
    setLoginLoading(false)
  }

  const handleVerifyOTP = async () => {
    setLoginError('')
    setLoginLoading(true)
    try {
      if (loginMethod === 'email') await apiVerifyCustomerEmailOTP(loginEmail, otpValue)
      else await apiVerifyCustomerPhoneOTP(loginPhone, otpValue)
      await refreshMe()
      if (onClose) onClose()
    } catch (e) {
      setLoginError(e.body?.detail || 'Invalid OTP')
    }
    setLoginLoading(false)
  }

  const handleLogout = async () => {
    await apiLogout()
    await refreshMe()
  }

  const googleLoginHandler = useGoogleLogin({
    flow: "implicit",
    onSuccess: async (tr) => {
      setLoginLoading(true);
      setLoginError("");
      try {
        if (typeof loginWithCustomerGoogle === 'function') {
          await loginWithCustomerGoogle(tr.access_token);
        } else {
          await apiCustomerGoogleLogin(tr.access_token);
        }
        await refreshMe();
        if (onClose) onClose();
      } catch (err) {
        setLoginError(extractAuthError(err, "Google login failed"));
      } finally {
        setLoginLoading(false);
      }
    },
    onError: (err) => {
      console.error("Google OAuth error:", err);
      setLoginLoading(false);
      setLoginError(err?.error_description || err?.error || "Google sign-in was cancelled or failed.");
    }
  });

  const [selectedMockBooking, setSelectedMockBooking] = useState(null)

  const [realBookings, setRealBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(false)

  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar_url || user?.avatar || user?.profile_picture || null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (user) {
      const uFullName = user?.firstName ? `${user.firstName} ${user?.lastName || ''}`.trim() : ''
      setProfileName(uFullName)
      setProfilePhone(user?.phone || '')
      setProfileEmail(user?.email || '')
      setProfileAvatar(user?.avatar_url || user?.avatar || user?.profile_picture || null)
    }
  }, [user])

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setProfileError('')
    setProfileSuccess('')
    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await apiRequest("/settings/catalog/upload-image/", {
        method: "POST",
        body: formData
      })
      const uploadedUrl = typeof res?.url === "string" ? res.url : (res?.url?.url || "");
      if (res.success && uploadedUrl) {
        setProfileAvatar(uploadedUrl)
        try {
          await apiRequest("/auth/profile/", {
            method: "PATCH",
            json: { avatar: uploadedUrl, profile_picture: uploadedUrl }
          })
        } catch (patchErr) {
          console.warn("Profile avatar patch warning:", patchErr)
        }
        await refreshMe()
        setProfileSuccess("Profile photo updated successfully!")
      } else {
        setProfileError(formatErrorMessage(res, "Failed to upload photo"))
      }
    } catch (err) {
      setProfileError(formatErrorMessage(err, "Error uploading photo"))
    }
  }

  const handleSaveProfile = async () => {
    setProfileError('')
    setProfileSuccess('')
    setIsSavingProfile(true)
    const nameParts = profileName.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ')

    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        phone: profilePhone,
        email: profileEmail
      }
      if (profileAvatar && typeof profileAvatar === "string") {
        payload.avatar = profileAvatar
        payload.profile_picture = profileAvatar
      }
      const res = await apiRequest("/auth/profile/", {
        method: "PATCH",
        json: payload
      })
      if (res.success || res.id || res.data || res.email) {
        await refreshMe()
        setProfileSuccess("Changes saved successfully!")
      } else {
        setProfileError(formatErrorMessage(res, "Failed to update profile"))
      }
    } catch (e) {
      setProfileError(formatErrorMessage(e, "Failed to update profile"))
    } finally {
      setIsSavingProfile(false)
    }
  }

  useEffect(() => {
    if (activeTab === "My Bookings" && user) {
      setBookingsLoading(true)
      apiFetchCustomerBookings()
        .then(res => setRealBookings(res.data || []))
        .catch(console.error)
        .finally(() => setBookingsLoading(false))
    }
  }, [activeTab, user])

  // ── Reschedule State ──────────────────────────────────────────────────────
  // ── Reschedule State ────────────────────────────────────────────────────────
  const [reschedules, setReschedules] = useState([])
  const [reschedulesLoading, setReschedulesLoading] = useState(false)
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [rescheduleBookingId, setRescheduleBookingId] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('09-10')
  const [rescheduleReason, setRescheduleReason] = useState('schedule_conflict')
  const [rescheduleNotes, setRescheduleNotes] = useState('')
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleError, setRescheduleError] = useState('')
  const [rescheduleSuccess, setRescheduleSuccess] = useState('')

  const [activeBookings, setActiveBookings] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // ── Refund State ──────────────────────────────────────────────────────────
  const [refunds, setRefunds] = useState([])
  const [refundsLoading, setRefundsLoading] = useState(false)
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [refundBookingId, setRefundBookingId] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('POOR_QUALITY')
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundError, setRefundError] = useState('')
  const [refundSuccess, setRefundSuccess] = useState('')

  const [eligibleRefundBookings, setEligibleRefundBookings] = useState([])
  const [refundSummary, setRefundSummary] = useState(null)
  const [refundSummaryLoading, setRefundSummaryLoading] = useState(false)
  const [refundType, setRefundType] = useState('FULL')
  const [refundRequestedAmount, setRefundRequestedAmount] = useState('')
  const [refundNotes, setRefundNotes] = useState('')
  const [refundFiles, setRefundFiles] = useState([])
  const [expandedRefundId, setExpandedRefundId] = useState(null)

  // ── Complaint State ─────────────────────────────────────────────────────────
  const [complaints, setComplaints] = useState([])
  const [complaintsLoading, setComplaintsLoading] = useState(false)
  const [showComplaintForm, setShowComplaintForm] = useState(false)
  const [complaintBookingId, setComplaintBookingId] = useState('')
  const [complaintCategory, setComplaintCategory] = useState('OTHER')
  const [complaintDesc, setComplaintDesc] = useState('')
  const [complaintSubmitting, setComplaintSubmitting] = useState(false)
  const [complaintError, setComplaintError] = useState('')
  const [complaintSuccess, setComplaintSuccess] = useState('')
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [complaintReply, setComplaintReply] = useState('')
  const [complaintReplying, setComplaintReplying] = useState(false)

  // ── Saved Addresses State ───────────────────────────────────────────────────
  const [savedAddresses, setSavedAddresses] = useState([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)

  const [addrLabel, setAddrLabel] = useState('home')
  const [addrLine1, setAddrLine1] = useState('')
  const [addrLine2, setAddrLine2] = useState('')
  const [addrCity, setAddrCity] = useState('')
  const [addrState, setAddrState] = useState('')
  const [addrPincode, setAddrPincode] = useState('')
  const [addrPhone, setAddrPhone] = useState('')
  const [addrIsDefault, setAddrIsDefault] = useState(false)
  const [addrSubmitting, setAddrSubmitting] = useState(false)
  const [addrError, setAddrError] = useState('')
  const [addrSuccess, setAddrSuccess] = useState('')

  const [mapAddress, setMapAddress] = useState(null)

  const humanizeLastUsed = (isoStr) => {
    if (!isoStr) return 'Never used'
    try {
      const d = new Date(isoStr)
      const diffMs = new Date() - d
      const diffSecs = Math.floor(diffMs / 1000)
      const diffMins = Math.floor(diffSecs / 60)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffSecs < 60) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 30) return `${diffDays} days ago`
      return d.toLocaleDateString()
    } catch {
      return 'Recently'
    }
  }

  const fetchAddresses = () => {
    setAddressesLoading(true)
    apiRequest('/auth/customer/addresses/')
      .then(r => setSavedAddresses(r.data || []))
      .catch(() => setSavedAddresses([]))
      .finally(() => setAddressesLoading(false))
  }

  useEffect(() => {
    if (activeTab === 'Saved Addresses' && user) {
      fetchAddresses()
    }
  }, [activeTab, user])

  useEffect(() => {
    if (activeTab === 'My Reschedules' && user) {
      setReschedulesLoading(true)
      apiRequest('/customer/reschedules/')
        .then(r => setReschedules(r.data || []))
        .catch(() => apiRequest('/booking/reschedule/').then(r => setReschedules(r.data || [])).catch(() => setReschedules([])))
        .finally(() => setReschedulesLoading(false))

      apiRequest('/customer/active-bookings/')
        .then(r => {
          const list = r.data || []
          setActiveBookings(list)
          if (list.length > 0 && !rescheduleBookingId) {
            setRescheduleBookingId(list[0].id)
          }
        })
        .catch(() => {
          apiRequest('/booking/my-bookings/').then(r => {
            const list = r.data || []
            setActiveBookings(list)
            if (list.length > 0 && !rescheduleBookingId) setRescheduleBookingId(list[0].id)
          }).catch(console.error)
        })
    }
  }, [activeTab, user])

  useEffect(() => {
    if (rescheduleBookingId && rescheduleDate) {
      setSlotsLoading(true)
      apiRequest(`/customer/bookings/${rescheduleBookingId}/slots/?date=${rescheduleDate}`)
        .then(r => {
          const slots = r.data || []
          setAvailableSlots(slots)
          const firstAvail = slots.find(s => s.is_available)
          if (firstAvail) setRescheduleTimeSlot(firstAvail.time_slot)
        })
        .catch(() => setAvailableSlots([]))
        .finally(() => setSlotsLoading(false))
    }
  }, [rescheduleBookingId, rescheduleDate])

  const fetchCustomerRefundData = () => {
    setRefundsLoading(true)
    apiRequest('/customer/refunds/')
      .then(r => setRefunds(r.data || []))
      .catch(() => apiRequest('/booking/refunds/').then(r => setRefunds(r.data || [])).catch(() => setRefunds([])))
      .finally(() => setRefundsLoading(false))

    apiRequest('/customer/refunds/eligible-bookings/')
      .then(r => {
        const list = r.data || []
        setEligibleRefundBookings(list)
        if (list.length > 0 && !refundBookingId) {
          setRefundBookingId(list[0].id)
        }
      })
      .catch(() => setEligibleRefundBookings([]))
  }

  useEffect(() => {
    if (activeTab === 'My Refunds' && user) {
      fetchCustomerRefundData()
    }
  }, [activeTab, user])

  useEffect(() => {
    if (refundBookingId) {
      setRefundSummaryLoading(true)
      apiRequest(`/customer/refunds/bookings/${refundBookingId}/summary/`)
        .then(r => {
          setRefundSummary(r.data)
          if (refundType === 'FULL' && r.data?.paid_amount) {
            setRefundRequestedAmount(r.data.paid_amount)
          }
        })
        .catch(() => setRefundSummary(null))
        .finally(() => setRefundSummaryLoading(false))
    }
  }, [refundBookingId, refundType])

  const handleSubmitReschedule = async () => {
    setRescheduleError(''); setRescheduleSuccess(''); setRescheduleSubmitting(true)
    try {
      const payload = {
        booking_id: rescheduleBookingId,
        new_date: rescheduleDate,
        new_time_slot: rescheduleTimeSlot,
        reason: rescheduleReason,
        additional_notes: rescheduleNotes,
      }
      let res;
      try {
        res = await apiRequest('/customer/reschedules/create/', { method: 'POST', json: payload })
      } catch (e) {
        res = await apiRequest('/booking/reschedule/', { method: 'POST', json: payload })
      }
      if (res.success || res.status === 'success') {
        setRescheduleSuccess('Reschedule request submitted successfully!')
        setShowRescheduleForm(false)
        setRescheduleDate('')
        setRescheduleNotes('')
        try {
          const updated = await apiRequest('/customer/reschedules/')
          setReschedules(updated.data || [])
        } catch (e) {
          const updated = await apiRequest('/booking/reschedule/')
          setReschedules(updated.data || [])
        }
      } else {
        setRescheduleError(res.error?.message || res.message || 'Failed to submit reschedule request.')
      }
    } catch (e) {
      setRescheduleError(e?.body?.message || e?.message || 'Failed to submit reschedule request.')
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  const handleSubmitRefund = async () => {
    setRefundError(''); setRefundSuccess(''); setRefundSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('booking_id', refundBookingId)
      formData.append('refund_type', refundType)
      formData.append('requested_amount', refundType === 'FULL' ? (refundSummary?.paid_amount || refundRequestedAmount) : refundRequestedAmount)
      formData.append('reason', refundReason || 'POOR_QUALITY')
      formData.append('additional_notes', refundNotes)

      if (refundFiles && refundFiles.length > 0) {
        for (let i = 0; i < refundFiles.length; i++) {
          formData.append('evidence', refundFiles[i])
        }
      }

      const token = localStorage.getItem('token') || localStorage.getItem('access_token')
      const response = await fetch('/api/customer/refunds/create/', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      })

      const res = await response.json()
      if (res.success || response.ok) {
        setRefundSuccess('Refund request submitted successfully!')
        setShowRefundForm(false)
        setRefundNotes('')
        setRefundFiles([])
        fetchCustomerRefundData()
      } else {
        const errObj = res.error || {}
        setRefundError(errObj.message || res.message || 'Failed to submit refund request.')
      }
    } catch (e) {
      setRefundError(e?.message || 'Failed to submit refund request.')
    } finally {
      setRefundSubmitting(false)
    }
  }

  const handleSubmitComplaint = async () => {
    setComplaintError(''); setComplaintSuccess(''); setComplaintSubmitting(true)
    try {
      const res = await apiRequest('/booking/complaints/create/', { method: 'POST', json: { booking_id: complaintBookingId || undefined, category: complaintCategory, description: complaintDesc } })
      if (res.success) {
        setComplaintSuccess('Complaint submitted! We will respond within 24 hours.')
        setShowComplaintForm(false); setComplaintBookingId(''); setComplaintCategory('OTHER'); setComplaintDesc('')
        const updated = await apiRequest('/booking/complaints/')
        setComplaints(updated.data || [])
      } else {
        const msg = typeof res.message === 'string' ? res.message : (res.message?.detail || res.error || 'Failed to submit complaint.')
        setComplaintError(msg)
      }
    } catch (e) {
      const msg = typeof e?.body?.message === 'string' ? e.body.message : (e?.body?.detail || e?.message || 'Failed to submit complaint.')
      setComplaintError(msg)
    }
    finally { setComplaintSubmitting(false) }
  }

  const handleComplaintReply = async (complaintId) => {
    if (!complaintReply.trim()) return
    setComplaintReplying(true)
    try {
      await apiRequest(`/booking/complaints/${complaintId}/response/`, { method: 'POST', json: { message: complaintReply } })
      setComplaintReply('')
      const res = await apiRequest(`/booking/complaints/${complaintId}/`)
      setSelectedComplaint(res.data)
    } catch (e) { console.error(e) }
    finally { setComplaintReplying(false) }
  }


  const userFullName = user?.firstName ? `${user.firstName} ${user?.lastName || ''}`.trim() : 'Customer'
  const userEmail = user?.email || ''
  const userPhone = user?.phone || ''

  const [mockAddresses, setMockAddresses] = useState([
    { id: 1, title: 'Home', address: 'Flat 402, Block A\nPrestige Sunrise\nBangalore, 560068' }
  ])
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [newAddressTitle, setNewAddressTitle] = useState('')
  const [newAddressText, setNewAddressText] = useState('')

  const handleAddAddress = () => {
    if (newAddressTitle.trim() && newAddressText.trim()) {
      if (editingAddressId) {
        setMockAddresses(mockAddresses.map(a => a.id === editingAddressId ? { ...a, title: newAddressTitle, address: newAddressText } : a))
      } else {
        setMockAddresses([...mockAddresses, { id: Date.now(), title: newAddressTitle, address: newAddressText }])
      }
      setIsAddingAddress(false)
      setEditingAddressId(null)
      setNewAddressTitle('')
      setNewAddressText('')
    }
  }

  const handleEditClick = (address) => {
    setEditingAddressId(address.id)
    setNewAddressTitle(address.title)
    setNewAddressText(address.address)
    setIsAddingAddress(true)
  }

  const handleRemoveAddress = (id) => {
    setMockAddresses(mockAddresses.filter(a => a.id !== id))
  }

  const tabs = [
    { id: "My Profile", icon: User },
    { id: "My Bookings", icon: Calendar },
    { id: "Saved Addresses", icon: MapPin },
    { id: "My Reschedules", icon: RefreshCw },
    { id: "My Refunds", icon: CreditCard },
    { id: "My Complaints", icon: MessageSquare },
    { id: "Payment Methods", icon: Wallet },
    { id: "Notifications", icon: Bell },
    { id: "Help & Support", icon: LifeBuoy },
  ]

  const mockBookings = [
    { id: "BK482910", service: "AC Servicing", date: "Aug 15, 2026", status: "Completed", amount: BOOKING_CURRENCY_SYMBOL + "899" },
    { id: "BK483122", service: "Deep Cleaning", date: "Sep 02, 2026", status: "Upcoming", amount: BOOKING_CURRENCY_SYMBOL + "2,499" },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case "My Profile":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>My Profile</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
                {profileAvatar || user?.avatar_url || user?.avatar || user?.profile_picture ? (
                  <img src={getFullImageUrl(profileAvatar || user?.avatar_url || user?.avatar || user?.profile_picture)} alt={userFullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7C3AED' }}>
                    {userFullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'C'}
                  </span>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginBottom: 4 }}>{userFullName}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 12 }}>{userEmail || userPhone}</div>
                <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0.5rem 1.25rem', background: 'white', color: '#7C3AED', border: '1.5px solid #7C3AED30', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  📷 Change Photo
                </button>
              </div>
            </div>

            {profileError && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, marginBottom: 16 }}>⚠️ {typeof profileError === 'string' ? profileError : formatErrorMessage(profileError)}</div>}
            {profileSuccess && <div style={{ background: '#f0fdf4', color: '#15803d', padding: '10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, marginBottom: 16 }}>{profileSuccess}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: 8 }}>Full Name</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: 8 }}>Phone Number</label>
                <input type="text" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: 8 }}>Email Address</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }} />
              </div>
            </div>
            <button onClick={handleSaveProfile} disabled={isSavingProfile} style={{ marginTop: 32, padding: '0.9rem 2.5rem', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 10px 20px rgba(124, 58, 237, 0.2)', opacity: isSavingProfile ? 0.7 : 1 }}>
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </motion.div>
        )
      case "My Bookings":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>My Bookings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {bookingsLoading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading bookings...</div> : realBookings.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No bookings found.</div> : realBookings.map(b => {
                const isRescheduleEligible = ['new_request', 'reviewed', 'confirmed', 'assigned', 'accepted'].includes(b.status)
                const getRescheduleNotice = (st) => {
                  if (['completed', 'closed', 'verified', 'feedback_pending', 'feedback_received'].includes(st)) {
                    return "Reschedule is unavailable because this service has already been completed."
                  }
                  if (['in_progress', 'on_the_way'].includes(st)) {
                    return "Reschedule is unavailable because service is currently in progress."
                  }
                  if (st === 'waiting_for_payment') {
                    return "Reschedule is unavailable while payment is pending."
                  }
                  if (['cancelled', 'rejected'].includes(st)) {
                    return "Reschedule is unavailable for cancelled/rejected bookings."
                  }
                  return null
                }
                const noticeMsg = getRescheduleNotice(b.status)

                return (
                  <React.Fragment key={b.id}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', position: 'relative', zIndex: 1 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>{(b.service_category_display || b.issue_title || 'Service Booking').replace(/â€“/g, ' - ').replace(/—/g, ' - ').replace(/&amp;/g, '&')}</span>
                          <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 99, fontWeight: 800, background: b.status === 'completed' ? '#10B98115' : '#7C3AED15', color: b.status === 'completed' ? '#10B981' : '#7C3AED', border: `1px solid ${b.status === 'completed' ? '#10B98130' : '#7C3AED30'}` }}>{b.status_display || b.status}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Calendar size={13} /> {b.preferred_date || 'N/A'} &nbsp;•&nbsp; <span style={{ fontFamily: 'monospace' }}>{b.request_id}</span></div>

                        {/* Reschedule Action for Eligible Bookings (Pending Confirmation, Confirmed, Employee Assigned) */}
                        {isRescheduleEligible && (
                          <div style={{ marginTop: 6 }}>
                            <button
                              onClick={() => {
                                setRescheduleBookingId(b.id)
                                if (b.preferred_date) setRescheduleDate(b.preferred_date)
                                setShowRescheduleForm(true)
                                if (typeof onChangeTab === 'function') onChangeTab('My Reschedules')
                              }}
                              style={{ padding: '6px 14px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px rgba(124,58,237,0.3)' }}
                              onMouseOver={e => e.currentTarget.style.background = '#6d28d9'}
                              onMouseOut={e => e.currentTarget.style.background = '#7C3AED'}
                            >
                              <RefreshCw size={13} /> Reschedule
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, color: ['paid', 'collected'].includes(b.payment_status) ? '#059669' : '#d97706', marginBottom: 12, fontSize: '1.05rem' }}>
                          {b.payment_status_display || (b.payment_status === 'paid' ? 'Paid' : b.payment_status === 'collected' ? 'Collected' : 'Pending')}
                        </div>
                        <button
                          onClick={() => setSelectedMockBooking(selectedMockBooking?.id === b.id ? null : b)}
                          style={{ fontSize: '0.85rem', padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7C3AED', fontWeight: 700, cursor: 'pointer', color: 'white', boxShadow: '0 2px 4px rgba(124,58,237,0.25)', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = '#6d28d9'}
                          onMouseOut={e => e.currentTarget.style.background = '#7C3AED'}
                        >
                          {selectedMockBooking?.id === b.id ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>
                    </div>

                    {selectedMockBooking?.id === b.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '1.5rem', marginTop: '-16px', position: 'relative', zIndex: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>📋 Full Booking Overview</div>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 800, color: '#7C3AED', background: '#7C3AED10', padding: '4px 10px', borderRadius: 8 }}>{b.request_id}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: '0.85rem' }}>
                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Assigned Technician</div>
                            <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                              👤 {b.assigned_employee ? (b.assigned_employee.full_name || b.assigned_employee.user?.first_name || 'Assigned Technician') : 'Not assigned yet'}
                            </div>
                            {b.assigned_employee?.phone && (
                              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>📞 {b.assigned_employee.phone}</div>
                            )}
                          </div>

                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Scheduled Date & Time</div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              📅 {b.preferred_date || 'Not scheduled'} {b.preferred_time ? `(${b.preferred_time})` : ''}
                            </div>
                          </div>

                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Payment Details</div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {b.payment_status_display || (b.payment_status === 'paid' ? 'Paid' : 'Pending')} · {b.payment_method_display || (b.payment_method === 'COD' ? 'Cash on Service' : 'Online Payment')}
                            </div>
                            {b.total_amount && (
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669', marginTop: 2 }}>Total: ₹{parseFloat(b.total_amount).toLocaleString('en-IN')}</div>
                            )}
                          </div>

                          <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Customer Info</div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{b.customer_name || user?.first_name || 'Customer'}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>✉️ {b.email || user?.email} {b.phone ? `· 📞 ${b.phone}` : ''}</div>
                          </div>

                          <div style={{ gridColumn: '1/-1', borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Service Address</div>
                            <div style={{ fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>📍 {b.address || 'N/A'}</div>
                          </div>

                          {b.description && (
                            <div style={{ gridColumn: '1/-1', borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                              <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Service Notes & Items</div>
                              <div style={{ fontWeight: 500, color: '#334155', background: 'white', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>{b.description}</div>
                            </div>
                          )}

                          <div style={{ gridColumn: '1/-1', borderTop: '1px solid #e2e8f0', paddingTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {(b.payment_status === 'paid' || b.payment_status === 'collected') && (
                              <>
                                <button onClick={() => window.open(`http://localhost:8000/api/booking/${b.id}/invoice/`, '_blank')} style={{ flex: 1, minWidth: 160, padding: '9px 14px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><FileText size={14} /> Download Invoice</button>
                                <button onClick={() => alert("Invoice successfully sent to your registered email!")} style={{ flex: 1, minWidth: 160, padding: '9px 14px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Mail size={14} /> Email Invoice</button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </motion.div>
        )
      case "Saved Addresses":
        const handleOpenForm = (addr = null) => {
          setAddrError('')
          setAddrSuccess('')
          if (addr) {
            setEditingAddress(addr)
            setAddrLabel(addr.label || 'home')
            setAddrLine1(addr.address_line1 || '')
            setAddrLine2(addr.address_line2 || '')
            setAddrCity(addr.city || '')
            setAddrState(addr.state || '')
            setAddrPincode(addr.pincode || '')
            setAddrPhone(addr.phone_number || '')
            setAddrIsDefault(!!addr.is_default)
          } else {
            setEditingAddress(null)
            setAddrLabel('home')
            setAddrLine1('')
            setAddrLine2('')
            setAddrCity('')
            setAddrState('')
            setAddrPincode('')
            setAddrPhone(user?.phone || '')
            setAddrIsDefault(savedAddresses.length === 0)
          }
          setShowAddressForm(true)
        }

        const handleSaveAddress = async () => {
          setAddrError('')
          setAddrSuccess('')
          if (!addrLine1.trim() || !addrCity.trim() || !addrState.trim() || !addrPincode.trim()) {
            setAddrError('Street Address, City, State, and Pincode are required.')
            return
          }

          setAddrSubmitting(true)
          const payload = {
            label: addrLabel,
            address_line1: addrLine1,
            address_line2: addrLine2,
            city: addrCity,
            state: addrState,
            pincode: addrPincode,
            phone_number: addrPhone,
            is_default: addrIsDefault,
          }

          try {
            const url = editingAddress
              ? `/auth/customer/addresses/${editingAddress.id}/`
              : '/auth/customer/addresses/'
            const method = editingAddress ? 'PATCH' : 'POST'
            const res = await apiRequest(url, { method, json: payload })

            if (res.success) {
              setAddrSuccess(editingAddress ? 'Address updated successfully!' : 'New address saved!')
              setShowAddressForm(false)
              fetchAddresses()
            } else {
              setAddrError(res.message || 'Failed to save address.')
            }
          } catch (e) {
            setAddrError(e?.body?.message || e?.message || 'Failed to save address.')
          } finally {
            setAddrSubmitting(false)
          }
        }

        const handleSetDefault = async (addrId) => {
          setAddrError('')
          setAddrSuccess('')
          try {
            const res = await apiRequest(`/auth/customer/addresses/${addrId}/set-default/`, { method: 'POST', json: {} })
            if (res.success) {
              setAddrSuccess('Default address updated!')
              fetchAddresses()
            } else {
              setAddrError(res.message || 'Failed to set default address.')
            }
          } catch (e) {
            setAddrError(e?.body?.message || e?.message || 'Failed to set default address.')
          }
        }

        const handleDelete = async (addrId) => {
          setAddrError('')
          setAddrSuccess('')
          try {
            const res = await apiRequest(`/auth/customer/addresses/${addrId}/`, { method: 'DELETE' })
            if (res.success) {
              setAddrSuccess('Address deleted successfully.')
              fetchAddresses()
            } else {
              setAddrError(res.message || 'Failed to delete address.')
            }
          } catch (e) {
            setAddrError(e?.body?.message || e?.message || 'Failed to delete address.')
          }
        }

        const handleUseForBooking = async (addr) => {
          try {
            await apiRequest(`/auth/customer/addresses/${addr.id}/mark-used/`, { method: 'POST', json: {} })
          } catch (e) {
            console.error(e)
          }
          const fullAddr = `${addr.address_line1}${addr.address_line2 ? ', ' + addr.address_line2 : ''}, ${addr.city}, ${addr.state} ${addr.pincode}`
          if (typeof setAddress === 'function') setAddress(fullAddr)
          setAddrSuccess(`Selected "${addr.label_display || addr.label}" for booking!`)
          setActiveTab('Book Service')
        }

        const labelIcons = {
          home: '🏠',
          work: '💼',
          other: '📍',
        }

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Saved Addresses</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Manage your home, office, and preferred service delivery locations.</p>
              </div>
              <button onClick={() => handleOpenForm(null)}
                style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(124,58,237,0.25)' }}>
                <MapPin size={15} /> Add New Address
              </button>
            </div>

            {addrSuccess && (
              <div style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, marginBottom: 20 }}>
                ✓ {addrSuccess}
              </div>
            )}

            {addrError && (
              <div style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, marginBottom: 20 }}>
                ⚠️ {addrError}
              </div>
            )}

            {showAddressForm ? (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                style={{ border: '1.5px solid #7C3AED30', borderRadius: 20, padding: '1.75rem', background: '#faf5ff', marginBottom: 24, boxShadow: '0 10px 25px -5px rgba(124,58,237,0.08)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 18, color: '#0f172a' }}>
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Address Label Pills */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Address Type
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[
                        { code: 'home', title: 'Home', icon: '🏠' },
                        { code: 'work', title: 'Work', icon: '💼' },
                        { code: 'other', title: 'Other', icon: '📍' },
                      ].map(type => (
                        <button key={type.code} type="button" onClick={() => setAddrLabel(type.code)}
                          style={{
                            padding: '10px 18px',
                            borderRadius: 12,
                            border: addrLabel === type.code ? '2px solid #7C3AED' : '1px solid #cbd5e1',
                            background: addrLabel === type.code ? '#f3e8ff' : 'white',
                            color: addrLabel === type.code ? '#7C3AED' : '#475569',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                          <span>{type.icon}</span> {type.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Street Lines */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Street Address (Line 1) *
                    </label>
                    <input value={addrLine1} onChange={e => setAddrLine1(e.target.value)} type="text" placeholder="e.g. 123 Main Street, Apt 4B"
                      style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', background: 'white' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Landmark / Suite (Line 2)
                    </label>
                    <input value={addrLine2} onChange={e => setAddrLine2(e.target.value)} type="text" placeholder="e.g. Near Central Park Tower"
                      style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', background: 'white' }} />
                  </div>

                  {/* City, State, Pincode */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>City *</label>
                      <input value={addrCity} onChange={e => setAddrCity(e.target.value)} type="text" placeholder="New York"
                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', background: 'white' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>State *</label>
                      <input value={addrState} onChange={e => setAddrState(e.target.value)} type="text" placeholder="NY"
                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', background: 'white' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>Pincode *</label>
                      <input value={addrPincode} onChange={e => setAddrPincode(e.target.value)} type="text" placeholder="10001"
                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', background: 'white' }} />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Contact Phone Number
                    </label>
                    <input value={addrPhone} onChange={e => setAddrPhone(e.target.value)} type="text" placeholder="+1 (555) 123-4567"
                      style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', background: 'white' }} />
                  </div>

                  {/* Set Default Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', marginTop: 4 }}>
                    <input type="checkbox" checked={addrIsDefault} onChange={e => setAddrIsDefault(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#7C3AED' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Set as Default Address for Bookings</span>
                  </label>

                  {/* Submit & Cancel */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button onClick={handleSaveAddress} disabled={addrSubmitting}
                      style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', opacity: addrSubmitting ? 0.7 : 1 }}>
                      {addrSubmitting ? 'Saving...' : (editingAddress ? 'Save Changes' : 'Save Address')}
                    </button>
                    <button onClick={() => { setShowAddressForm(false); setEditingAddress(null); }}
                      style={{ padding: '12px 20px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', color: '#475569' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div>
                {addressesLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading saved addresses...</div>
                ) : savedAddresses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'white', borderRadius: 20, border: '1px solid #e2e8f0' }}>
                    <MapPin size={40} style={{ marginBottom: 14, color: '#cbd5e1' }} />
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>No saved addresses found.</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>Add your home or office location to enable fast 1-click booking.</div>
                    <button onClick={() => handleOpenForm(null)}
                      style={{ marginTop: 16, padding: '10px 20px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                      + Add Your First Address
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
                    {savedAddresses.map(addr => {
                      const icon = labelIcons[addr.label] || '📍'
                      return (
                        <div key={addr.id}
                          style={{
                            border: addr.is_default ? '2px solid #7C3AED' : '1px solid #e2e8f0',
                            borderRadius: 18,
                            padding: '1.35rem',
                            background: 'white',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            justify: 'space-between',
                            position: 'relative'
                          }}>

                          <div>
                            {/* Card Header: Icon, Label, Default Badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', textTransform: 'capitalize' }}>
                                  {addr.label_display || addr.label}
                                </span>
                              </div>
                              {addr.is_default && (
                                <span style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: 99, fontWeight: 800, background: '#7C3AED', color: 'white' }}>
                                  Default
                                </span>
                              )}
                            </div>

                            {/* Address Lines */}
                            <div style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>
                              <div>{addr.address_line1}</div>
                              {addr.address_line2 && <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{addr.address_line2}</div>}
                              <div style={{ color: '#475569', fontSize: '0.83rem', marginTop: 2 }}>
                                {addr.city}, {addr.state} - <strong>{addr.pincode}</strong>
                              </div>
                            </div>

                            {/* Phone & Last Used Row */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>📞</span> <strong style={{ color: '#334155' }}>{addr.phone_number || user?.phone || 'No phone attached'}</strong>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>🕒</span> <span>Last used: <strong style={{ color: '#475569' }}>{humanizeLastUsed(addr.last_used_at)}</strong></span>
                              </div>
                            </div>

                            {/* Serviceability Row */}
                            <div style={{ marginBottom: 14 }}>
                              {addr.serviceable ? (
                                <span style={{ fontSize: '0.73rem', padding: '4px 10px', borderRadius: 99, fontWeight: 800, background: '#d1fae5', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  ✓ Service Available
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.73rem', padding: '4px 10px', borderRadius: 99, fontWeight: 800, background: '#fee2e2', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  ✕ {addr.serviceability_reason || 'Not Serviceable'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Row */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                            <button onClick={() => handleUseForBooking(addr)}
                              style={{ width: '100%', padding: '9px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                              Use for Booking
                            </button>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                              <button onClick={() => setMapAddress(addr)}
                                style={{ padding: '7px 4px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', color: '#475569', textAlign: 'center' }}>
                                🗺️ Map
                              </button>

                              <button onClick={() => handleOpenForm(addr)}
                                style={{ padding: '7px 4px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', color: '#475569', textAlign: 'center' }}>
                                ✏️ Edit
                              </button>

                              {!addr.is_default ? (
                                <button onClick={() => handleSetDefault(addr.id)}
                                  style={{ padding: '7px 4px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', color: '#7C3AED', textAlign: 'center' }}>
                                  ⭐ Default
                                </button>
                              ) : (
                                <span style={{ padding: '7px 4px', background: '#f1f5f9', borderRadius: 8, fontWeight: 700, fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
                                  ⭐ Default
                                </span>
                              )}

                              <button onClick={() => handleDelete(addr.id)}
                                style={{ padding: '7px 4px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', color: '#dc2626', textAlign: 'center' }}>
                                🗑️ Delete
                              </button>
                            </div>
                          </div>

                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* View Map Modal */}
            {mapAddress && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  style={{ background: 'white', borderRadius: 20, width: '90%', maxWidth: 480, padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>Location Map View</h4>
                    <button onClick={() => setMapAddress(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>

                  <div style={{ background: '#f1f5f9', borderRadius: 14, height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid #cbd5e1', marginBottom: 14 }}>
                    <MapPin size={36} color="#7C3AED" />
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{mapAddress.label_display || mapAddress.label}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Coordinates: {mapAddress.latitude || '37.7749'}, {mapAddress.longitude || '-122.4194'}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, marginBottom: 16 }}>
                    <div>{mapAddress.address_line1} {mapAddress.address_line2}</div>
                    <div style={{ color: '#64748b' }}>{mapAddress.city}, {mapAddress.state} - {mapAddress.pincode}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress.address_line1 + ', ' + mapAddress.city)}`, '_blank')}
                      style={{ flex: 1, padding: '10px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                      Open in Google Maps
                    </button>
                    <button onClick={() => setMapAddress(null)}
                      style={{ padding: '10px 18px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', color: '#475569' }}>
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )
      case "Payment Methods":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Payment Methods</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* COD Info */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: '20px',
                background: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                gap: 16,
                alignItems: 'center'
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#10B98115', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CreditCard size={22} color="#10B981" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>Cash on Service (COD)</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Pay securely in cash directly to our service professional after the job is successfully completed.
                  </p>
                </div>
              </div>

              {/* UPI Info */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: '20px',
                background: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                gap: 16,
                alignItems: 'center'
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#7C3AED15', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wallet size={22} color="#7C3AED" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>UPI Payments</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Pay instantly online via Google Pay, PhonePe, Paytm, or BHIM during the checkout process.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )
      case "Notifications":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Notifications</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#7C3AED', marginTop: 6 }} />
                <div style={{ flex: 1, paddingBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>Booking Confirmed</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 6, lineHeight: 1.5 }}>Your AC Servicing booking for Aug 15 is confirmed. Our expert will arrive on time.</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 8, fontWeight: 600 }}>2 days ago</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#cbd5e1', marginTop: 6 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>Promo Code Applied</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 6, lineHeight: 1.5 }}>You successfully saved {BOOKING_CURRENCY_SYMBOL}100 on your last Deep Cleaning booking!</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 8, fontWeight: 600 }}>1 week ago</div>
                </div>
              </div>
            </div>
          </motion.div>
        )
      case "Help & Support":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Help & Support</h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, background: 'linear-gradient(to right bottom, #f8fafc, #f1f5f9)' }}>
              <h4 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '1.1rem', fontWeight: 800 }}>Need assistance?</h4>
              <p style={{ margin: '0 0 24px', color: '#475569', fontSize: '0.9rem', lineHeight: 1.6 }}>Our dedicated support team is available 24/7 to help you with your bookings, payments, and general queries.</p>
              <button style={{ padding: '0.85rem 1.75rem', background: '#0f172a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>Contact Support</button>
            </div>
            <h4 style={{ margin: '32px 0 16px', color: '#0f172a', fontSize: '1.1rem', fontWeight: 800 }}>Frequently Asked Questions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {["How to cancel a booking?", "What is the 30-day guarantee?", "How to change my address?", "Are the professionals background checked?"].map((q, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'white', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>{q}</span>
                  <ChevronDown size={18} color="#94a3b8" />
                </div>
              ))}
            </div>
          </motion.div>
        )
      case "My Reschedules":
        const selectedBooking = activeBookings.find(b => String(b.id) === String(rescheduleBookingId)) || activeBookings[0]
        const slotDefinitions = [
          { code: '09-10', label: '09:00 AM - 10:00 AM' },
          { code: '10-11', label: '10:00 AM - 11:00 AM' },
          { code: '11-12', label: '11:00 AM - 12:00 PM' },
          { code: '14-15', label: '02:00 PM - 03:00 PM' },
          { code: '15-16', label: '03:00 PM - 04:00 PM' },
        ]

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>My Reschedule Requests</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Request and track schedule modifications for your active service bookings.</p>
              </div>
              <button onClick={() => {
                setShowRescheduleForm(!showRescheduleForm);
                setRescheduleError('');
                setRescheduleSuccess('');
                if (activeBookings.length > 0 && !rescheduleBookingId) {
                  setRescheduleBookingId(activeBookings[0].id)
                }
              }}
                style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(124,58,237,0.25)' }}>
                <RefreshCw size={15} /> {showRescheduleForm ? 'Close Form' : 'New Request'}
              </button>
            </div>

            {rescheduleSuccess && (
              <div style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                ✓ {rescheduleSuccess}
              </div>
            )}

            {showRescheduleForm && (
              <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                style={{ border: '1.5px solid #7C3AED30', borderRadius: 20, padding: '1.75rem', background: '#faf5ff', marginBottom: 24, boxShadow: '0 10px 25px -5px rgba(124,58,237,0.08)' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>New Reschedule Request</h4>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#7C3AED15', color: '#7C3AED' }}>Guided Workflow</span>
                </div>

                {rescheduleError && (
                  <div style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 12, fontSize: '0.83rem', fontWeight: 600, marginBottom: 16 }}>
                    ⚠️ {rescheduleError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* 1. Select Booking */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      1. Select Booking to Reschedule
                    </label>
                    {activeBookings.length === 0 ? (
                      <div style={{ padding: '1rem', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        No active bookings eligible for rescheduling found.
                      </div>
                    ) : (
                      <select value={rescheduleBookingId} onChange={e => setRescheduleBookingId(e.target.value)}
                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700, background: 'white', outline: 'none' }}>
                        {activeBookings.map(b => {
                          const rawTitle = b.issue_title || b.service_category || 'Service Booking'
                          const cleanTitle = rawTitle.replace(/â€“/g, ' - ').replace(/—/g, ' - ').replace(/&amp;/g, '&')
                          return (
                            <option key={b.id} value={b.id}>
                              {cleanTitle} ({b.request_id || `SR-${b.id}`}) — Current: {b.preferred_date || b.created_at?.split('T')[0]}
                            </option>
                          )
                        })}
                      </select>
                    )}
                  </div>

                  {/* 2. Current Schedule Read-Only Display */}
                  {selectedBooking && (
                    <div style={{ background: 'white', borderRadius: 14, padding: '1rem 1.25rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Current Schedule</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                          📅 {selectedBooking.preferred_date || 'Not set'} | ⏰ {selectedBooking.preferred_time || '09-10 (Morning)'}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: 99, background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                        Active Snapshot
                      </span>
                    </div>
                  )}

                  {/* 3. New Date & Time Slot */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        2. New Preferred Date
                      </label>
                      <input value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} type="date" min={new Date().toISOString().split('T')[0]}
                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700, background: 'white' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Reason for Rescheduling
                      </label>
                      <select value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)}
                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700, background: 'white' }}>
                        <option value="schedule_conflict">Schedule Conflict</option>
                        <option value="emergency">Personal Emergency</option>
                        <option value="weather_delay">Weather Delay</option>
                        <option value="technical_issue">Technical Issue</option>
                        <option value="customer_request">Customer Preference</option>
                        <option value="other">Other Reason</option>
                      </select>
                    </div>
                  </div>

                  {/* 4. Available Time Slots Grid */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      3. Select Available Time Slot {slotsLoading && <span style={{ color: '#7C3AED', fontWeight: 600 }}>(Checking technician availability...)</span>}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                      {slotDefinitions.map(slot => {
                        const availInfo = availableSlots.find(s => s.time_slot === slot.code)
                        const isAvailable = availInfo ? availInfo.is_available : true
                        const isSelected = rescheduleTimeSlot === slot.code

                        return (
                          <button key={slot.code} type="button" disabled={!isAvailable} onClick={() => setRescheduleTimeSlot(slot.code)}
                            style={{
                              padding: '12px',
                              borderRadius: 12,
                              border: isSelected ? '2px solid #7C3AED' : '1px solid #e2e8f0',
                              background: isSelected ? '#f3e8ff' : isAvailable ? 'white' : '#f8fafc',
                              color: isSelected ? '#7C3AED' : isAvailable ? '#0f172a' : '#94a3b8',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              textAlign: 'left',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              opacity: isAvailable ? 1 : 0.6,
                              transition: 'all 0.15s ease'
                            }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{slot.label}</span>
                              {isSelected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C3AED' }} />}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: isAvailable ? (isSelected ? '#7C3AED' : '#10B981') : '#ef4444', fontWeight: 800 }}>
                              {isAvailable ? '✓ Available' : '✕ Fully Booked'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 5. Additional Notes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Additional Notes (Optional)
                    </label>
                    <textarea value={rescheduleNotes} onChange={e => setRescheduleNotes(e.target.value)} rows={2}
                      placeholder="Add any additional details for the admin or technician..."
                      style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', color: '#0f172a', resize: 'none', background: 'white' }} />
                  </div>

                  {/* 6. Reschedule Policy Checklist */}
                  <div style={{ background: '#f8fafc', borderRadius: 14, padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
                      ⚡ CalTrack Reschedule Policy
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem', color: '#64748b' }}>
                      <div>✓ Free reschedule when requested at least 12 hours prior to start time</div>
                      <div>✓ Real-time technician availability checking & scoring algorithm</div>
                      <div>✓ Automatic booking update once confirmed by technician/admin</div>
                    </div>
                  </div>

                  {/* 7. Reactive Summary Block */}
                  <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', color: 'white', borderRadius: 16, padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>
                      Schedule Summary Preview
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', fontSize: '0.88rem' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Old Schedule</div>
                        <div style={{ fontWeight: 700, marginTop: 2 }}>{selectedBooking?.preferred_date || 'N/A'} ({selectedBooking?.preferred_time || '09-10'})</div>
                      </div>
                      <div style={{ fontSize: '1.2rem', color: '#a855f7', fontWeight: 900 }}>➔</div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 800 }}>New Schedule</div>
                        <div style={{ fontWeight: 800, color: '#4ade80', marginTop: 2 }}>{rescheduleDate || 'Select Date'} ({rescheduleTimeSlot})</div>
                      </div>
                    </div>
                  </div>

                  {/* 8. Submit & Cancel Action Buttons */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    <button onClick={handleSubmitReschedule} disabled={rescheduleSubmitting || !rescheduleBookingId || !rescheduleDate || !rescheduleTimeSlot}
                      style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', opacity: (rescheduleSubmitting || !rescheduleBookingId || !rescheduleDate || !rescheduleTimeSlot) ? 0.6 : 1, boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
                      {rescheduleSubmitting ? 'Submitting...' : 'Submit Reschedule Request'}
                    </button>
                    <button onClick={() => setShowRescheduleForm(false)}
                      style={{ padding: '12px 20px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', color: '#475569' }}>
                      Cancel
                    </button>
                  </div>

                </div>
              </motion.div>
            )}

            {/* List of Requests */}
            {reschedulesLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading reschedule requests...</div>
            ) : reschedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'white', borderRadius: 20, border: '1px solid #e2e8f0' }}>
                <RefreshCw size={40} style={{ marginBottom: 14, color: '#cbd5e1' }} />
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>No reschedule requests yet.</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>Click "New Request" above to request a schedule change for your active bookings.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {reschedules.map(r => {
                  const statusConfig = {
                    PENDING: { bg: '#FEF3C7', color: '#D97706', label: 'Pending Admin Review' },
                    ADMIN_REVIEW: { bg: '#E0E7FF', color: '#4F46E5', label: 'Under Admin Review' },
                    SLOT_SUGGESTED: { bg: '#F5F3FF', color: '#7C3AED', label: 'Admin Suggested New Slot' },
                    AWAITING_EMPLOYEE_RESPONSE: { bg: '#EFF6FF', color: '#2563EB', label: 'Awaiting Technician Confirmation' },
                    REASSIGNMENT_NEEDED: { bg: '#FFF7ED', color: '#C2410C', label: 'Finding Another Technician' },
                    RESCHEDULED: { bg: '#D1FAE5', color: '#059669', label: '✓ Rescheduled Successfully' },
                    REJECTED: { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
                    CANCELLED: { bg: '#F1F5F9', color: '#64748B', label: 'Cancelled' },
                    APPROVED: { bg: '#D1FAE5', color: '#059669', label: 'Approved' },
                    CUSTOMER_NOTIFIED: { bg: '#D1FAE5', color: '#059669', label: 'Confirmed & Updated' },
                    TECHNICIAN_CONFIRMATION: { bg: '#F3E8FF', color: '#7C3AED', label: 'Awaiting Tech Confirmation' },
                  }
                  const sc = statusConfig[r.status] || { bg: '#F1F5F9', color: '#64748B', label: r.status_display || r.status }
                  const currentDisplay = r.current_date ? `${r.current_date} (${r.current_time || '09-10'})` : 'N/A'
                  const newDisplay = `${r.new_date} (${r.new_time_slot || '09-10'})`
                  const suggestedDisplay = r.suggested_date ? `${r.suggested_date} (${r.suggested_time_slot || '—'})` : null
                  const isTerminal = ['RESCHEDULED', 'REJECTED', 'CANCELLED'].includes(r.status)

                  return (
                    <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.35rem', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', marginBottom: 2 }}>
                            {r.issue_title || r.booking_service || 'Service Booking'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                            {r.reschedule_id || `REQ-${r.id}`} · {r.request_id || r.booking_request_id || '—'}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', padding: '6px 12px', borderRadius: 99, fontWeight: 800, background: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                      </div>

                      {/* Schedule Visualizer */}
                      <div style={{ background: '#0f172a', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.82rem' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Current</div>
                          <div style={{ color: 'white', fontWeight: 700 }}>{currentDisplay}</div>
                        </div>
                        <span style={{ color: '#a855f7', fontWeight: 900, fontSize: '1.1rem' }}>→</span>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Requested</div>
                          <div style={{ color: '#6ee7b7', fontWeight: 700 }}>{newDisplay}</div>
                        </div>
                        {suggestedDisplay && (
                          <>
                            <span style={{ color: '#c084fc', fontWeight: 900 }}>✦</span>
                            <div>
                              <div style={{ fontSize: '0.65rem', color: '#c084fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Admin Suggests</div>
                              <div style={{ color: '#e9d5ff', fontWeight: 700 }}>{suggestedDisplay}</div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Details */}
                      <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                        <div><span style={{ fontWeight: 700 }}>Reason:</span> {r.reason}</div>
                        {r.additional_notes && <div><span style={{ fontWeight: 700 }}>Notes:</span> {r.additional_notes}</div>}
                        {r.review_notes && <div style={{ color: '#4f46e5' }}><span style={{ fontWeight: 700 }}>Admin Note:</span> {r.review_notes}</div>}
                        {r.rejection_reason && <div style={{ color: '#dc2626' }}><span style={{ fontWeight: 700 }}>Rejection:</span> {r.rejection_reason_display || r.rejection_reason} {r.rejection_notes && `— ${r.rejection_notes}`}</div>}
                        {r.proposed_technician_name && <div style={{ color: '#2563eb' }}><span style={{ fontWeight: 700 }}>Technician:</span> {r.proposed_technician_name}</div>}
                      </div>

                      {/* 8-Step Dynamic Customer UI Progress Tracker */}
                      {!['REJECTED', 'CANCELLED'].includes(r.status) && (
                        <div style={{ marginTop: 14, marginBottom: 16, padding: '14px 16px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Progress Tracker</span>
                            <span style={{ color: '#6366f1' }}>Step {r.step_index || (r.status === 'RESCHEDULED' ? 8 : r.status === 'AWAITING_EMPLOYEE_RESPONSE' ? 6 : 2)} of 8</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                            {[
                              { num: 1, label: 'Submitted' },
                              { num: 2, label: 'Under Review' },
                              { num: 3, label: 'Admin Approved' },
                              { num: 4, label: 'Assignment' },
                              { num: 5, label: 'Tech Assigned' },
                              { num: 6, label: 'Waiting Tech' },
                              { num: 7, label: 'Updating' },
                              { num: 8, label: 'Rescheduled' },
                            ].map(st => {
                              const stepIdx = r.step_index || (
                                r.status === 'RESCHEDULED' ? 8 :
                                  r.status === 'EMPLOYEE_ACCEPTED' ? 7 :
                                    (r.status === 'AWAITING_EMPLOYEE_RESPONSE' || r.status === 'AWAITING_EMPLOYEE_CONFIRMATION') ? 6 :
                                      (r.status === 'EMPLOYEE_ASSIGNED') ? 5 :
                                        (r.status === 'ADMIN_APPROVED' || r.status === 'REASSIGNMENT_NEEDED') ? 4 :
                                          (r.status === 'ADMIN_REVIEW') ? 2 : 1
                              )
                              const isCompleted = stepIdx > st.num || r.status === 'RESCHEDULED'
                              const isCurrent = stepIdx === st.num && r.status !== 'RESCHEDULED'

                              return (
                                <div key={st.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textCenter: 'center' }}>
                                  <div style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 900,
                                    background: isCompleted ? '#10b981' : isCurrent ? '#6366f1' : '#e2e8f0',
                                    color: (isCompleted || isCurrent) ? 'white' : '#94a3b8',
                                    boxShadow: isCurrent ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
                                    transition: 'all 0.2s ease',
                                    marginBottom: 4,
                                  }}>
                                    {isCompleted ? '✓' : st.num}
                                  </div>
                                  <div style={{
                                    fontSize: '0.62rem', fontWeight: isCurrent ? 900 : 700,
                                    color: isCompleted ? '#059669' : isCurrent ? '#4f46e5' : '#94a3b8',
                                    textAlign: 'center', lineHeight: 1.1
                                  }}>
                                    {st.label}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Status-specific info banners */}
                      {r.status === 'AWAITING_EMPLOYEE_RESPONSE' && (
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 600, marginBottom: 10 }}>
                          🔄 Your request was approved. Waiting for <strong>{r.proposed_technician_name || 'the technician'}</strong> to confirm availability.
                        </div>
                      )}
                      {r.status === 'REASSIGNMENT_NEEDED' && (
                        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', color: '#c2410c', fontWeight: 600, marginBottom: 10 }}>
                          ⚙️ The assigned technician was unavailable. Admin is finding a replacement — no action needed from you.
                        </div>
                      )}
                      {r.status === 'RESCHEDULED' && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', color: '#15803d', fontWeight: 700, marginBottom: 10 }}>
                          ✅ Your booking has been rescheduled to <strong>{newDisplay}</strong>. See you then!
                        </div>
                      )}

                      {/* SLOT_SUGGESTED — Accept / Decline buttons */}
                      {r.status === 'SLOT_SUGGESTED' && suggestedDisplay && (
                        <div style={{ background: '#faf5ff', border: '1.5px solid #d8b4fe', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                          <div style={{ fontWeight: 800, color: '#6d28d9', fontSize: '0.88rem', marginBottom: 8 }}>
                            🗓 Admin suggested a new time slot: <strong>{suggestedDisplay}</strong>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#7c3aed', marginBottom: 12 }}>
                            Accept or decline this suggestion. Accepting will re-enter review with the suggested slot.
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await apiRequest(`/customer/reschedules/${r.id}/respond-suggestion/`, {
                                    method: 'POST', json: { accept: true }
                                  })
                                  if (res?.success) {
                                    const updated = await apiRequest('/customer/reschedules/')
                                    setReschedules(updated.data || [])
                                  }
                                } catch (e) { console.error(e) }
                              }}
                              style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              ✓ Accept Suggested Slot
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm("Decline this suggested slot? Your request will be marked as rejected.")) return
                                try {
                                  const res = await apiRequest(`/customer/reschedules/${r.id}/respond-suggestion/`, {
                                    method: 'POST', json: { accept: false }
                                  })
                                  if (res?.success) {
                                    const updated = await apiRequest('/customer/reschedules/')
                                    setReschedules(updated.data || [])
                                  }
                                } catch (e) { console.error(e) }
                              }}
                              style={{ padding: '9px 20px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              ✕ Decline Suggestion
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Cancel button — only for PENDING */}
                      {r.status === 'PENDING' && (
                        <button onClick={async () => {
                          try {
                            await apiRequest(`/customer/reschedules/${r.id}/cancel/`, { method: 'POST', json: {} })
                            const updated = await apiRequest('/customer/reschedules/')
                            setReschedules(updated.data || [])
                          } catch (e) {
                            try {
                              await apiRequest(`/booking/reschedule/${r.id}/cancel/`, { method: 'POST', json: {} })
                              const updated = await apiRequest('/booking/reschedule/')
                              setReschedules(updated.data || [])
                            } catch (err) { console.error(err) }
                          }
                        }}
                          style={{ marginTop: 6, padding: '8px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                          Cancel Request
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )

      case "My Refunds":
        const selectedRefundBooking = eligibleRefundBookings.find(b => String(b.id) === String(refundBookingId)) || eligibleRefundBookings[0]
        const refundReasonChoices = [
          { code: 'POOR_QUALITY', label: 'Poor Quality Work' },
          { code: 'SERVICE_NOT_COMPLETED', label: 'Service Not Completed' },
          { code: 'CANCELLED_BY_PROVIDER', label: 'Cancelled By Provider' },
          { code: 'OVERCHARGED', label: 'Overcharged' },
          { code: 'OTHER', label: 'Other Issue' },
        ]

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>My Refund Requests</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Request refunds for completed paid bookings and track resolution timeline.</p>
              </div>
              <button onClick={() => { setShowRefundForm(!showRefundForm); setRefundError(''); setRefundSuccess(''); }}
                style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(124,58,237,0.25)' }}>
                <CreditCard size={15} /> {showRefundForm ? 'Close Form' : 'Request Refund'}
              </button>
            </div>

            {refundSuccess && (
              <div style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                ✓ {refundSuccess}
              </div>
            )}

            {showRefundForm && (
              <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                style={{ border: '1.5px solid #7C3AED30', borderRadius: 20, padding: '1.75rem', background: '#faf5ff', marginBottom: 24, boxShadow: '0 10px 25px -5px rgba(124,58,237,0.08)' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>New Refund Request</h4>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#7C3AED15', color: '#7C3AED' }}>Guided Refund Flow</span>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', fontSize: '0.83rem', color: '#92400e', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <div>Refunds are only available for paid completed bookings. The requested amount cannot exceed what was paid.</div>
                </div>

                {refundError && (
                  <div style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 12, fontSize: '0.83rem', fontWeight: 600, marginBottom: 16 }}>
                    ⚠️ {refundError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* 1. Select Booking */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      1. Select Paid Booking
                    </label>
                    {eligibleRefundBookings.length === 0 ? (
                      <div style={{ padding: '1rem', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        No eligible paid bookings available for refund.
                      </div>
                    ) : (
                      <select value={refundBookingId} onChange={e => setRefundBookingId(e.target.value)}
                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700, background: 'white' }}>
                        {eligibleRefundBookings.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.issue_title || b.request_id} — {b.request_id} ({BOOKING_CURRENCY_SYMBOL}{b.estimated_cost || '500'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 2. Booking Refund Summary Card */}
                  {refundSummary && (
                    <div style={{ background: 'white', borderRadius: 16, padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: 10 }}>
                        Booking Financial Summary
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Paid Amount</div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', marginTop: 2 }}>{BOOKING_CURRENCY_SYMBOL}{refundSummary.paid_amount}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Max Refundable</div>
                          <div style={{ fontWeight: 800, color: '#7C3AED', fontSize: '1.05rem', marginTop: 2 }}>{BOOKING_CURRENCY_SYMBOL}{refundSummary.max_refundable_amount}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Status</div>
                          <div style={{ fontWeight: 800, color: refundSummary.eligible ? '#10B981' : '#EF4444', fontSize: '0.85rem', marginTop: 4 }}>
                            {refundSummary.eligible ? '✓ Eligible' : '✕ Ineligible'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Refund Type Choice Pills */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2. Refund Type
                    </label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {[
                        { code: 'FULL', label: 'Full Refund', desc: '100% of total paid amount' },
                        { code: 'PARTIAL', label: 'Partial Refund', desc: 'Custom specific amount' },
                      ].map(t => {
                        const isSel = refundType === t.code
                        return (
                          <button key={t.code} onClick={() => {
                            setRefundType(t.code)
                            if (t.code === 'FULL' && refundSummary?.paid_amount) {
                              setRefundRequestedAmount(refundSummary.paid_amount)
                            }
                          }}
                            style={{
                              flex: 1, padding: '0.85rem 1rem', borderRadius: 14,
                              border: isSel ? '2px solid #7C3AED' : '1.5px solid #e2e8f0',
                              background: isSel ? 'linear-gradient(135deg,#7C3AED15,#a855f715)' : 'white',
                              cursor: 'pointer', textAlign: 'left',
                            }}>
                            <div style={{ fontWeight: 800, color: isSel ? '#7C3AED' : '#0f172a', fontSize: '0.88rem' }}>{t.label}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{t.desc}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 4. Amount Input (only for partial) */}
                  {refundType === 'PARTIAL' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        3. Refund Amount (₹)
                      </label>
                      <input
                        type="number" min="1" max={refundSummary?.max_refundable_amount}
                        value={refundRequestedAmount} onChange={e => setRefundRequestedAmount(e.target.value)}
                        placeholder={`Max: ₹${refundSummary?.max_refundable_amount || '—'}`}
                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                  )}

                  {/* 5. Reason */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {refundType === 'PARTIAL' ? '4.' : '3.'} Reason for Refund
                    </label>
                    <select value={refundReason} onChange={e => setRefundReason(e.target.value)}
                      style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700, background: 'white' }}>
                      <option value="">Select a reason...</option>
                      {refundReasonChoices.map(rc => (
                        <option key={rc.code} value={rc.code}>{rc.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 6. Additional Notes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#334155', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Additional Notes <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>(optional)</span>
                    </label>
                    <textarea value={refundNotes} onChange={e => setRefundNotes(e.target.value)}
                      rows={3} placeholder="Describe the issue in detail..."
                      style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', color: '#0f172a', resize: 'none' }} />
                  </div>

                  {/* 7. Submit */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <button onClick={handleSubmitRefund}
                      disabled={refundSubmitting || !refundBookingId || !refundReason || (refundType === 'PARTIAL' && !refundRequestedAmount)}
                      style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', opacity: (refundSubmitting || !refundBookingId || !refundReason) ? 0.6 : 1, boxShadow: '0 4px 14px rgba(124,58,237,0.25)' }}>
                      {refundSubmitting ? 'Submitting...' : 'Submit Refund Request'}
                    </button>
                    <button onClick={() => setShowRefundForm(false)}
                      style={{ padding: '12px 20px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', color: '#475569' }}>
                      Cancel
                    </button>
                  </div>

                </div>
              </motion.div>
            )}

            {refundsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading refund requests...</div>
            ) : refunds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <CreditCard size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                <div style={{ fontWeight: 700 }}>No refund requests yet.</div>
                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>Request a refund for any completed paid booking.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {refunds.map(r => {
                  const sc = { REQUESTED: '#F59E0B', UNDER_REVIEW: '#3B82F6', APPROVED: '#8B5CF6', REJECTED: '#EF4444', PROCESSED: '#10B981', FAILED: '#EF4444' }[r.status] || '#64748b'
                  return (
                    <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '1.25rem', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', marginBottom: 4 }}>{r.booking_service || 'Service Booking'}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>{r.booking_request_id}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#7C3AED', marginBottom: 4 }}>₹{r.amount}</div>
                          <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: 99, fontWeight: 800, background: sc + '18', color: sc, border: `1px solid ${sc}30` }}>{r.status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}><span style={{ fontWeight: 700 }}>Reason:</span> {r.reason}</div>
                      {r.admin_notes && <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}><span style={{ fontWeight: 700 }}>Admin Notes:</span> {r.admin_notes}</div>}
                      {r.gateway_reference && <div style={{ fontSize: '0.78rem', color: '#64748b' }}><span style={{ fontWeight: 700 }}>Reference:</span> {r.gateway_reference}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )

      case "My Complaints":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {selectedComplaint ? (
              // Complaint thread view
              <div>
                <button onClick={() => setSelectedComplaint(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#7C3AED', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', marginBottom: 16 }}>
                  <ChevronLeft size={18} /> Back to Complaints
                </button>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '1.5rem', background: 'white', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginBottom: 2 }}>{selectedComplaint.category_display}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>
                        Ticket #{selectedComplaint.complaint_number || selectedComplaint.id} {selectedComplaint.booking_request_id ? `• Booking: ${selectedComplaint.booking_request_id}` : ''}
                      </div>
                    </div>
                    {(() => {
                      const sc = { OPEN: '#F59E0B', IN_PROGRESS: '#3B82F6', UNDER_INVESTIGATION: '#3B82F6', RESOLVED: '#10B981', ESCALATED: '#EF4444', CLOSED: '#94a3b8' }[selectedComplaint.status] || '#64748b'
                      return <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 99, fontWeight: 800, background: sc + '18', color: sc, border: `1px solid ${sc}30` }}>{selectedComplaint.status_display || selectedComplaint.status}</span>
                    })()}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #f1f5f9' }}>
                    <strong style={{ color: '#0f172a', display: 'block', marginBottom: 4 }}>Reported Issue Details:</strong>
                    {selectedComplaint.description}
                  </div>
                  {selectedComplaint.resolution_notes && (
                    <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12, color: '#166534', fontSize: '0.85rem' }}>
                      <strong style={{ display: 'block', marginBottom: 2 }}>✅ Support Team Resolution:</strong>
                      {selectedComplaint.resolution_notes}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', marginBottom: 12 }}>Conversation Thread</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                  {(selectedComplaint.messages || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>No responses yet. Our team will respond within 24 hours.</div>
                  )}
                  {(selectedComplaint.messages || []).map(resp => {
                    const isCustomer = resp.persona === 'CUSTOMER'
                    return (
                      <div key={resp.id} style={{ display: 'flex', justifyContent: isCustomer ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: isCustomer ? '14px 14px 2px 14px' : '14px 14px 14px 2px', background: isCustomer ? 'linear-gradient(135deg,#7C3AED,#a855f7)' : '#f1f5f9', color: isCustomer ? 'white' : '#0f172a', fontSize: '0.85rem', lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.7rem', opacity: 0.75, marginBottom: 4 }}>{isCustomer ? 'You' : resp.persona === 'ADMIN' ? 'ðŸ›¡ï¸ Support Team' : '👷 Employee'}</div>
                          {resp.message}
                          <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: 4 }}>{new Date(resp.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {selectedComplaint.status !== 'CLOSED' && selectedComplaint.status !== 'RESOLVED' && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input value={complaintReply} onChange={e => setComplaintReply(e.target.value)} placeholder="Type your reply..." onKeyDown={e => e.key === 'Enter' && handleComplaintReply(selectedComplaint.id)}
                      style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', color: '#0f172a' }} />
                    <button onClick={() => handleComplaintReply(selectedComplaint.id)} disabled={complaintReplying || !complaintReply.trim()}
                      style={{ padding: '0.8rem 1.2rem', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', opacity: complaintReplying ? 0.7 : 1 }}>
                      Send
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Complaints list view
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>My Complaints</h3>
                  <button onClick={() => { setShowComplaintForm(true); setComplaintError(''); setComplaintSuccess(''); }}
                    style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={14} /> New Complaint
                  </button>
                </div>

                {complaintSuccess && <div style={{ background: '#f0fdf4', color: '#15803d', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, marginBottom: 16 }}>✅ {complaintSuccess}</div>}

                {showComplaintForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ border: '1.5px solid #7C3AED30', borderRadius: 16, padding: '1.5rem', background: '#faf5ff', marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginBottom: 16 }}>File a New Complaint</div>
                    {complaintError && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, marginBottom: 12 }}>{complaintError}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: 6 }}>Category</label>
                        <select value={complaintCategory} onChange={e => setComplaintCategory(e.target.value)}
                          style={{ width: '100%', padding: '0.8rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', background: 'white' }}>
                          <option value="SERVICE_QUALITY">Service Quality</option>
                          <option value="EMPLOYEE_BEHAVIOR">Employee Behavior</option>
                          <option value="BILLING">Billing</option>
                          <option value="SCHEDULING">Scheduling</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: 6 }}>Booking ID (optional)</label>
                        <input value={complaintBookingId} onChange={e => setComplaintBookingId(e.target.value)} placeholder="Leave blank for general complaint" type="text"
                          style={{ width: '100%', padding: '0.8rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: 6 }}>Describe Your Issue</label>
                        <textarea value={complaintDesc} onChange={e => setComplaintDesc(e.target.value)} rows={4} placeholder="Please describe your issue in detail..."
                          style={{ width: '100%', padding: '0.8rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', resize: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button onClick={handleSubmitComplaint} disabled={complaintSubmitting || !complaintDesc}
                          style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', opacity: complaintSubmitting ? 0.7 : 1 }}>
                          {complaintSubmitting ? 'Submitting...' : 'Submit Complaint'}
                        </button>
                        <button onClick={() => setShowComplaintForm(false)}
                          style={{ padding: '10px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', color: '#475569' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {complaintsLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading complaints...</div>
                ) : complaints.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <MessageSquare size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                    <div style={{ fontWeight: 700 }}>No complaints filed yet.</div>
                    <div style={{ fontSize: '0.85rem', marginTop: 4 }}>If you have an issue with a service, let us know!</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {complaints.map(c => {
                      const sc = { OPEN: '#F59E0B', IN_PROGRESS: '#3B82F6', RESOLVED: '#10B981', ESCALATED: '#EF4444', CLOSED: '#94a3b8' }[c.status] || '#64748b'
                      return (
                        <div key={c.id} onClick={async () => {
                          const res = await apiRequest(`/booking/complaints/${c.id}/`)
                          setSelectedComplaint(res.data)
                        }}
                          style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '1.25rem', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = '#7C3AED50'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', marginBottom: 2 }}>{c.category_display}</div>
                              {c.booking_request_id && <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{c.booking_request_id}</div>}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: 99, fontWeight: 800, background: sc + '18', color: sc, border: `1px solid ${sc}30`, display: 'block', marginBottom: 4 }}>{c.status_display}</span>
                              {c.attachment_count > 0 && <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>📎 {c.attachment_count} file{c.attachment_count > 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</div>
                          <div style={{ marginTop: 10, fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span style={{ color: '#7C3AED', fontWeight: 700 }}>View Thread →</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )

      case "Payment Methods":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Payment Methods</h3>
            <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.85rem' }}>Manage your saved cards, UPI IDs, and preferred payment options for instant checkout.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '1.2rem', border: '1.5px solid #10B98130', borderRadius: 14, background: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#10B98115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={22} color="#10B981" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Cash on Service (COD)</div>
                    <div style={{ color: '#059669', fontSize: '0.78rem', fontWeight: 600, marginTop: 2 }}>✓ Active & Preferred</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#10B981', color: 'white', padding: '4px 10px', borderRadius: 8 }}>Default</span>
              </div>

              <div style={{ padding: '1.2rem', border: '1px solid #e2e8f0', borderRadius: 14, background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#7C3AED10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={22} color="#7C3AED" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>UPI & Net Banking</div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>Razorpay / PhonePe / Google Pay</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7C3AED', background: '#7C3AED10', padding: '4px 10px', borderRadius: 8 }}>Verified</span>
              </div>

              <button onClick={() => alert("Payment method saved successfully!")}
                style={{ width: '100%', padding: '1rem', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 14, color: '#475569', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                + Add New Card or UPI ID
              </button>
            </div>
          </motion.div>
        )

      case "Notifications":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Notifications</h3>
            <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.85rem' }}>Recent service alerts, scheduling updates, and support messages.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: 12, background: 'white', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#7C3AED15', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: '0.9rem' }}>🔔</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: 2 }}>Technician Assigned</div>
                  <div style={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.4 }}>Your technician has been assigned for your upcoming booking.</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 4 }}>Just now</div>
                </div>
              </div>

              <div style={{ padding: '1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: 12, background: 'white', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#10B98115', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: '0.9rem' }}>✅</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: 2 }}>Booking Confirmed</div>
                  <div style={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.4 }}>Your service request is confirmed and scheduled for execution.</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 4 }}>Today, 10:30 AM</div>
                </div>
              </div>
            </div>
          </motion.div>
        )

      case "Help & Support":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Help & Support</h3>
            <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.85rem' }}>We're here 24/7 to assist with your bookings and service inquiries.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: 14, background: '#faf5ff', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📞</div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Customer Helpline</div>
                <div style={{ color: '#7C3AED', fontWeight: 800, fontSize: '0.85rem', marginTop: 4 }}>+91 1800-123-4567</div>
              </div>

              <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: 14, background: '#f0fdf4', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>✉️</div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Email Support</div>
                <div style={{ color: '#059669', fontWeight: 800, fontSize: '0.85rem', marginTop: 4 }}>support@caltrack.com</div>
              </div>
            </div>

            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', marginBottom: 12 }}>Frequently Asked Questions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <details style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, background: 'white', fontSize: '0.85rem' }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>How do I cancel or reschedule my booking?</summary>
                <p style={{ color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>Navigate to 'My Reschedules' tab in this portal to submit a new date and time slot request.</p>
              </details>
              <details style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, background: 'white', fontSize: '0.85rem' }}>
                <summary style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>What is the 30-day service warranty?</summary>
                <p style={{ color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>All completed services are backed by a 30-day quality guarantee. If an issue recurs, file a complaint in 'My Complaints' for a free re-visit.</p>
              </details>
            </div>
          </motion.div>
        )

      default:
        return null
    }
  }

  if (!user) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 10050, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onClose}>
        <motion.div
          initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          style={{ background: 'white', padding: '3rem', borderRadius: 24, width: '100%', maxWidth: 440, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}
        >
          <div onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Welcome Back</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: 32 }}>Log in to view your bookings and manage your profile.</p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button onClick={() => { setLoginMethod('email'); setOtpSent(false); setLoginError(''); }} style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', border: loginMethod === 'email' ? '2px solid #7C3AED' : '1px solid #e2e8f0', background: loginMethod === 'email' ? '#7C3AED10' : 'white', color: loginMethod === 'email' ? '#7C3AED' : '#64748b' }}>Email</button>
            <button onClick={() => { setLoginMethod('phone'); setOtpSent(false); setLoginError(''); }} style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', border: loginMethod === 'phone' ? '2px solid #7C3AED' : '1px solid #e2e8f0', background: loginMethod === 'phone' ? '#7C3AED10' : 'white', color: loginMethod === 'phone' ? '#7C3AED' : '#64748b' }}>Phone</button>
          </div>

          {loginError && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, marginBottom: 20 }}>{loginError}</div>}

          {!otpSent ? (
            <>
              {loginMethod === 'email' ? (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>Email Address</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: '1rem', color: '#0f172a' }} />
                </div>
              ) : (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>Phone Number</label>
                  <input type="tel" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: '1rem', color: '#0f172a' }} />
                </div>
              )}
              <button onClick={handleRequestOTP} disabled={loginLoading} style={{ width: '100%', padding: '14px', background: '#7C3AED', color: 'white', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', opacity: loginLoading ? 0.7 : 1 }}>
                {loginLoading ? 'Sending...' : 'Send Login Code'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div style={{ flex: 1, height: 1, background: '#cbd5e1' }} />
                <span style={{ padding: '0 10px' }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#cbd5e1' }} />
              </div>

              <button
                type="button"
                onClick={() => googleLoginHandler()}
                disabled={loginLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'white',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  opacity: loginLoading ? 0.7 : 1
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.8 2.17c1.64-1.51 2.59-3.74 2.59-6.5z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.8-2.17c-.78.52-1.78.83-2.8.83-2.34 0-4.32-1.58-5.03-3.7L1.47 13.07C2.95 16 6.01 18 9 18z" />
                  <path fill="#FBBC05" d="M3.97 10.78c-.18-.52-.28-1.09-.28-1.68s.1-1.16.28-1.68L1.47 5.12C.53 7 0 9.08 0 11.2s.53 4.2 1.47 6.08l2.5-1.9c-.71-2.12-.71-4.4 0-6.5z" />
                  <path fill="#EA4335" d="M9 3.58c1.32-.03 2.59.48 3.51 1.4l2.63-2.63C13.48.88 11.3.02 9 0 6.01 0 2.95 2 1.47 4.93l2.5 1.9C4.68 5.16 6.66 3.58 9 3.58z" />
                </svg>
                Continue with Google
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>Enter 6-digit OTP</label>
                <input type="text" value={otpValue} onChange={e => setOtpValue(e.target.value)} placeholder="123456" maxLength={6} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: '1.2rem', letterSpacing: '4px', textAlign: 'center', color: '#0f172a', fontWeight: 700 }} />
              </div>
              <button onClick={handleVerifyOTP} disabled={loginLoading} style={{ width: '100%', padding: '14px', background: '#7C3AED', color: 'white', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', opacity: loginLoading ? 0.7 : 1 }}>
                {loginLoading ? 'Verifying...' : 'Verify & Login'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => setOtpSent(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Change {loginMethod === 'email' ? 'Email' : 'Phone'}</button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 10050, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <motion.div
        initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', damping: 35, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 900, background: 'white', height: '100%', display: 'flex', boxShadow: '-20px 0 50px rgba(0,0,0,0.15)' }}
      >
        {/* Sidebar */}
        <div style={{ width: 280, background: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '2.5rem 0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0 2rem', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
              {user?.avatar_url || user?.avatar || user?.profile_picture ? (
                <img
                  src={getFullImageUrl(user?.avatar_url || user?.avatar || user?.profile_picture)}
                  alt={userFullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7C3AED' }}>
                  {userFullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'C'}
                </span>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>{userFullName}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>{userEmail || userPhone}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {tabs.map(t => (
              <div
                key={t.id}
                onClick={() => onChangeTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '1rem 2rem', cursor: 'pointer',
                  background: activeTab === t.id ? 'white' : 'transparent',
                  borderLeft: `4px solid ${activeTab === t.id ? '#7C3AED' : 'transparent'}`,
                  color: activeTab === t.id ? '#7C3AED' : '#475569',
                  fontWeight: activeTab === t.id ? 800 : 600,
                  fontSize: '0.95rem',
                  transition: 'all 0.2s'
                }}
              >
                <t.icon size={20} color={activeTab === t.id ? '#7C3AED' : '#94a3b8'} /> {t.id}
              </div>
            ))}
          </div>
          <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%', padding: '0.8rem 1rem', background: '#fef2f2',
                color: '#ef4444', border: '1px solid #fee2e2', borderRadius: 10,
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <LogOut size={18} />
              Log Out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, padding: '3rem', overflowY: 'auto', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <div onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
              <X size={20} />
            </div>
          </div>
          <div style={{ maxWidth: 500 }}>
            {renderTabContent()}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export function BookingPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showCartMenu, setShowCartMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [error, setError] = useState(null)
  const [successData, setSuccessData] = useState(null)
  const [category, setCategory] = useState(null)
  const [cart, setCart] = useState([])
  const [selDate, setSelDate] = useState("")
  const [selTime, setSelTime] = useState("")
  const [formData, setFormData] = useState({ customer_name: "", phone: "", email: "", issue_title: "", description: "", address: "" })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [dynamicReviews, setDynamicReviews] = useState([])

  const [searchQuery, setSearchQuery] = useState("")
  const [location, setLocation] = useState("H37, Block H- Saket- Ne...")
  const [showLocPicker, setShowLocPicker] = useState(false)
  const [showPostFlow, setShowPostFlow] = useState(false)
  const [assignedTech, setAssignedTech] = useState(null)
  const [showAccountPortal, setShowAccountPortal] = useState(false)
  const [activeAccountTab, setActiveAccountTab] = useState("My Profile")
  const contentRef = useRef()

  useEffect(() => { contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }) }, [step])

  // Inject Google GSI client library dynamically
  useEffect(() => {
    if (!document.getElementById("google-gsi-script")) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  const handleChange = e => {
    const { name, value } = e.target
    setFormData(p => ({ ...p, [name]: value }))
  }

  const [categoriesData, setCategoriesData] = useState([])
  const [packagesData, setPackagesData] = useState({})

  useEffect(() => {
    async function loadCatalog() {
      try {
        const catRes = await apiRequest("/catalog/categories/")
        const svcRes = await apiRequest("/catalog/services/")
        let loadedCats = []
        if (catRes.success) {
          loadedCats = catRes.data.map((c, i) => ({
            id: c.id.toString(),
            slug: c.slug || c.id.toString(),
            name: c.name,
            desc: c.description || c.desc || ("Expert " + c.name + " service"),
            rating: c.rating || "4.8",
            jobs: c.jobs_count_str || c.jobs || "10K+",
            image: getFullImageUrl(c.image) || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&q=80&fit=crop"
          }))
          setCategoriesData(loadedCats)
        }
        if (svcRes.success) {
          if (svcRes.currency_symbol) {
            BOOKING_CURRENCY_SYMBOL = svcRes.currency_symbol;
          }
          const pkgs = {}
          svcRes.data.forEach(s => {
            const cid = s.category ? s.category.toString() : ""
            if (!cid) return

            const catObj = loadedCats.find(c => c.id === cid || c.slug === cid)
            const cSlug = catObj?.slug || ""
            const cName = catObj?.name ? catObj.name.toLowerCase() : ""

            const pkgObj = {
              id: s.id.toString(),
              name: s.name,
              price: parseFloat(s.price),
              priceStr: BOOKING_CURRENCY_SYMBOL + s.price,
              duration: s.duration || "1-2 Hrs",
              payment_policy: s.payment_policy || "BOTH",
              image: getFullImageUrl(s.image) || getFullImageUrl(catObj?.image) || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&q=80&fit=crop",
              includes: Array.isArray(s.includes) && s.includes.length > 0 ? s.includes : [s.name + " Service", "Professional Inspection", "Service Guarantee"],
              excludes: Array.isArray(s.excludes) ? s.excludes : [],
              popular: !!s.popular,
              tag: s.tag || (s.popular ? "Most Booked" : "")
            }

            if (!pkgs[cid]) pkgs[cid] = []
            pkgs[cid].push(pkgObj)

            if (cSlug) {
              if (!pkgs[cSlug]) pkgs[cSlug] = []
              if (!pkgs[cSlug].some(item => item.id === pkgObj.id)) pkgs[cSlug].push(pkgObj)
            }
            if (cName) {
              if (!pkgs[cName]) pkgs[cName] = []
              if (!pkgs[cName].some(item => item.id === pkgObj.id)) pkgs[cName].push(pkgObj)
            }
          })
          setPackagesData(pkgs)
        }
      } catch (e) {
        console.error("Failed to load catalog", e)
      }
    }
    loadCatalog()

    // Handle URL search parameters for category/service redirect
    const catParam = searchParams.get('category') || searchParams.get('cat')
    if (catParam && categoriesData.length > 0) {
      const foundCat = categoriesData.find(c => c.id === catParam || c.slug === catParam || c.name.toLowerCase() === catParam.toLowerCase())
      if (foundCat) {
        setCategory(foundCat)
        setShowPackageModal(true)
      }
    }

    // Fetch initial location
    if (navigator.geolocation) {
      setLocation("Detecting location...")
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.features && data.features.length > 0) {
                const p = data.features[0].properties;
                const display = [p.name, p.street, p.city, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
                setLocation(display);
              } else {
                setLocation("Location not found");
              }
            })
            .catch(() => setLocation("Unable to determine location"));
        },
        () => {
          setLocation("Select a location");
        }
      );
    } else {
      setLocation("Select a location");
    }
  }, [])

  useEffect(() => {
    let query = "";
    if (category) {
      query = `?category=${encodeURIComponent(category.id || category.name)}`;
    }
    apiRequest(`/public/feedback/${query}`)
      .then(res => {
        if (res?.success && res.data && res.data.length > 0) {
          const formatted = res.data.map(r => ({
            name: r.name,
            rating: r.rating,
            text: r.text,
            cat: r.category,
            ago: getRelativeTime(r.submitted_at),
            avatar: generateAvatarUrl(r.name)
          }));
          setDynamicReviews(formatted);
        } else {
          setDynamicReviews([]);
        }
      })
      .catch(err => console.error("Error fetching feedback:", err));
  }, [category]);

  const handlePhoto = e => {
    const f = e.target.files[0]
    if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)) }
  }

  const handleSubmit = async (paymentMethod = "cash") => {
    setLoading(true); setError(null)
    // Map frontend choices to backend enum values
    const backendPaymentMethod = paymentMethod === "online" ? "ONLINE" : "COD"

    const data = new FormData()
    data.append("customer_name", formData.customer_name)
    data.append("phone", formData.phone)
    data.append("email", formData.email || "")
    data.append("service_category", category?.id || "general")
    data.append("issue_title", formData.issue_title || `${cart.map(c => c.name).join(', ')} — ${category?.name}`)
    data.append("description", formData.description || "")
    data.append("address", formData.landmark ? formData.address + " | " + formData.landmark : formData.address)
    data.append("preferred_date", selDate)
    data.append("preferred_time", selTime)
    data.append("total_amount", cart.reduce((a, c) => a + (c.price * c.quantity), 0))
    // Serialize cart_data as JSON string — backend will parse it robustly
    data.append("cart_data", JSON.stringify(cart.map(c => ({
      id: c.id, name: c.name, price: c.price, quantity: c.quantity,
      categoryName: c.categoryName || category?.name || ""
    }))))
    data.append("payment_method", backendPaymentMethod)
    if (photoFile) data.append("photo", photoFile)
    try {
      const res = await apiRequest("/booking/", { method: "POST", body: data })
      if (res?.success) {
        if (backendPaymentMethod === "ONLINE") {
          // If online payment was chosen, the mock payment gateway was already shown and simulated success.
          // Now we inform the backend that payment was collected successfully to confirm the booking.
          try {
            await apiRequest('/payment/verify/', {
              method: 'POST',
              json: { booking_id: res.data.id, order_id: `order_mock_${Date.now()}`, payment_id: `PAY_${Date.now().toString(36).toUpperCase()}`, mock_success: true }
            })
          } catch (e) {
            console.error("Failed to verify online payment:", e)
          }
        }
        setSuccessData({ ...res.data, paymentMethod: backendPaymentMethod })
        setShowPostFlow(true)  // Show animated post-booking flow
      } else setError(res?.message || "Something went wrong. Please try again.")
    } catch (err) {
      if (err?.body?.errors) {
        const msgs = Object.entries(err.body.errors).map(([f, m]) => `${f}: ${Array.isArray(m) ? m.join(", ") : m}`).join(" · ")
        setError(msgs || err.body.message)
      } else setError(err?.body?.message || err?.body?.detail || "Connection error. Try again.")
    } finally { setLoading(false) }
  }


  const resetAll = () => {
    setStep(1); setCategory(null); setCart([]); setSelDate(""); setSelTime("")
    setFormData({ customer_name: "", phone: "", email: "", issue_title: "", description: "", address: "", landmark: "" })
    setPhotoFile(null); setPhotoPreview(null); setSuccessData(null); setError(null)
    setShowPostFlow(false); setAssignedTech(null)
    sessionStorage.removeItem(OTP_SESSION_KEY)
  }

  return (
    <div className="uc-root">
      <BkStyles />

      <AnimatePresence>
        {showLocPicker && (
          <LocationPickerModal
            initialLocation={location}
            onClose={() => setShowLocPicker(false)}
            onConfirm={(loc) => { setLocation(loc); setShowLocPicker(false); }}
          />
        )}
      </AnimatePresence>

      {/* Post-Booking Animated Flow Overlay */}
      <AnimatePresence>
        {showPostFlow && (
          <PostBookingFlow
            bookingData={successData}
            category={category}
            cart={cart}
            formData={formData}
            selDate={selDate}
            selTime={selTime}
            onDone={(tech) => {
              setAssignedTech(tech)
              setShowPostFlow(false)
              setStep(0)
            }}
          />
        )}
      </AnimatePresence>

      {/* Sticky Nav */}
      <header className="uc-nav">
        <div className="uc-nav-left">
          <CalTrackLogo size="sm" showTagline={false} theme="light" />
        </div>

        <div className="uc-nav-right-icons">
          <div className="uc-location-selector" onClick={() => setShowLocPicker(true)}>
            <MapPin size={15} color="#64748b" />
            <span className="uc-loc-text">{location.split(',')[0]}</span>
            <ChevronDown size={14} color="#64748b" />
          </div>
          <div className="uc-nav-search">
            <Search size={15} color="#94a3b8" />
            <input type="text" placeholder="Search for 'AC service'" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setStep(1); }} />
          </div>
          {/* Cart Dropdown */}
          <div className="uc-cart-icon"
            onMouseEnter={() => setShowCartMenu(true)}
            onMouseLeave={() => setShowCartMenu(false)}
            onClick={() => step > 1 && setStep(6)}>
            <ShoppingCart size={20} color="#1e293b" />
            {(cart.length > 0 || step > 1) && <span className="uc-cart-badge">{cart.reduce((a, c) => a + c.quantity, 0) || 1}</span>}

            {showCartMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', zIndex: 1000, boxShadow: '0 10px 40px rgba(0,0,0,0.12)', width: 280, marginTop: '10px', cursor: 'default' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingCart size={16} /> Cart {cart.length > 0 ? `(${cart.reduce((a, c) => a + c.quantity, 0)} Items)` : "(Empty)"}
                </div>
                <div style={{ height: 1, background: '#e2e8f0', margin: '0.5rem 0' }} />

                {cart.length > 0 ? (
                  <>
                    {cart.map((c, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '0.8rem 0', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <CheckCircle2 size={14} color="#10B981" style={{ marginTop: 2 }} />
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{c.quantity}x {c.name}</div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>{c.categoryName}</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, color: '#1e293b' }}>{BOOKING_CURRENCY_SYMBOL}{c.price * c.quantity}</div>
                      </div>
                    ))}

                    <div style={{ height: 1, background: '#e2e8f0', margin: '0.5rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', margin: '0.8rem 0' }}>
                      <span>Total Items : {cart.reduce((a, c) => a + c.quantity, 0)}</span>
                      <span>Total Price : {BOOKING_CURRENCY_SYMBOL}{cart.reduce((a, c) => a + (c.price * c.quantity), 0)}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      <button onClick={() => setStep(6)} style={{ width: '100%', padding: '0.6rem', background: '#f1f5f9', color: '#0f172a', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}>View Cart</button>
                      <button onClick={() => setStep(6)} style={{ width: '100%', padding: '0.6rem', background: '#7C3AED', color: 'white', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}>Proceed to Booking</button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '2rem 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Your cart is empty</div>
                )}
              </div>
            )}
          </div>

          {/* Profile Icon (Opens Account Portal directly) */}
          <div className="uc-profile-icon" onClick={() => {
            setShowAccountPortal(true);
            setActiveAccountTab("My Profile");
          }} style={{ overflow: 'hidden', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {user?.avatar_url || user?.avatar || user?.profile_picture ? (
              <img
                src={getFullImageUrl(user?.avatar_url || user?.avatar || user?.profile_picture)}
                alt={user?.firstName || 'User'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <User size={20} color="#1e293b" />
            )}
          </div>
        </div>
      </header>

      {/* Account Portal Modal */}
      <AnimatePresence>
        {showAccountPortal && (
          <CustomerAccountModal
            activeTab={activeAccountTab}
            onChangeTab={setActiveAccountTab}
            onClose={() => setShowAccountPortal(false)}
          />
        )}
      </AnimatePresence>


      {step > 1 && step <= 6 && (
        <div className="uc-nav-summary">
          <SummaryBar category={category} cart={cart} date={selDate} time={selTime} step={step} />
        </div>
      )}



      {/* Main Content */}
      <main className="uc-main" ref={contentRef}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LiveTrackingPage
                successData={successData}
                technician={assignedTech}
                category={category}
                cart={cart}
                formData={formData}
                selDate={selDate}
                selTime={selTime}
                onBookAgain={resetAll}
              />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StepHome searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSelect={cat => { setCategory(cat); setShowPackageModal(true) }} categories={categoriesData} dynamicReviews={dynamicReviews} />
            </motion.div>
          )}

          {/* step 2 was here */}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="uc-step-container">
                <StepSchedule
                  category={category}
                  selectedDate={selDate}
                  selectedTime={selTime}
                  onDateChange={setSelDate}
                  onTimeChange={setSelTime}
                  onNext={() => setStep(4)}
                  onBack={() => { setStep(1); setShowPackageModal(true); }}
                />
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="uc-step-container">
                <StepLogin
                  category={category}
                  onBack={() => setStep(3)}
                  onVerified={data => {
                    setFormData(p => ({
                      ...p,
                      customer_name: data.name || p.customer_name,
                      phone: data.phone || p.phone,
                      email: data.email || p.email,
                    }))
                    setStep(5)
                  }}
                />
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="uc-step-container">
                <StepDetails
                  category={category}
                  cart={cart}
                  formData={formData}
                  onChange={handleChange}
                  photoFile={photoFile}
                  onPhotoChange={handlePhoto}
                  photoPreview={photoPreview}
                  onNext={() => setStep(6)}
                  onBack={() => setStep(4)}
                  globalLocation={location}
                  onOpenMap={() => setShowLocPicker(true)}
                />
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div key="step6" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="uc-step-container">
                <StepConfirm
                  category={category}
                  pkg={cart[0] || { name: "Multiple Items", priceStr: BOOKING_CURRENCY_SYMBOL + cart.reduce((a, c) => a + (c.price * c.quantity), 0) }}
                  cart={cart}
                  date={selDate}
                  time={selTime}
                  formData={formData}
                  photoPreview={photoPreview}
                  onBack={() => setStep(5)}
                  onSubmit={handleSubmit}
                  loading={loading}
                  error={error}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="uc-footer">
        <Shield size={12} /> SSL Encrypted &nbsp;·&nbsp;
        <Star size={12} style={{ fill: "#F59E0B", color: "#F59E0B" }} /> 4.8★ Rated &nbsp;·&nbsp;
        <CheckCircle2 size={12} /> 1M+ Bookings &nbsp;·&nbsp;
        <Award size={12} /> 30-Day Guarantee
      </footer>

      {/* Package Selection Modal Overlay */}
      <AnimatePresence>
        {showPackageModal && category && (
          <PackageModal
            category={category}
            cart={cart}
            setCart={setCart}
            packagesData={packagesData}
            onClose={() => setShowPackageModal(false)}
            onCheckout={() => { setShowPackageModal(false); setStep(3); }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function PackageModal({ category, cart, setCart, onClose, onCheckout, packagesData }) {
  const [activeTab, setActiveTab] = useState(0)
  const [activeFilter, setActiveFilter] = useState("All")
  const rawList = (packagesData && (packagesData[category?.id] || packagesData[category?.slug] || packagesData[category?.name?.toLowerCase()])) || PACKAGES[category?.id] || PACKAGES[category?.slug] || []
  const packages = rawList.map(p => ({ ...p, priceStr: BOOKING_CURRENCY_SYMBOL + p.price }))
  const relatedServices = packages.slice(0, 4);

  const filteredPackages = packages.filter(p => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Premium") return p.price >= 1000;
    if (activeFilter === "Standard") return p.price < 1000;
    return true;
  });

  const getCartCount = (pkgId) => {
    const item = cart.find(c => c.id === pkgId);
    return item ? item.quantity : 0;
  }

  const addToCart = (pkg) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === pkg.id);
      if (existing) {
        return prev.map(c => c.id === pkg.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...pkg, quantity: 1, categoryName: category.name }];
    });
  }

  const removeFromCart = (pkgId) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === pkgId);
      if (existing.quantity === 1) {
        return prev.filter(c => c.id !== pkgId);
      }
      return prev.map(c => c.id === pkgId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  }

  const renderCard = (p, i) => (
    <motion.div
      key={p.id}
      className="uc-pkg-modal-card-uc"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.1 }}
    >
      <div className="uc-pkg-modal-card-uc-info">
        <h3 className="uc-pkg-uc-title">{p.name}</h3>
        <div className="uc-pkg-uc-rating">
          <Star size={12} style={{ fill: "#7C3AED", color: "#7C3AED", marginRight: 4 }} />
          <span style={{ fontWeight: 700 }}>4.8</span> <span style={{ color: "#94a3b8", textDecoration: "underline" }}>(113K reviews)</span>
        </div>
        <div className="uc-pkg-uc-price">
          Starts at {p.priceStr} <span className="uc-pkg-uc-dot">•</span> {p.duration}
        </div>
        <ul className="uc-pkg-uc-includes">
          {p.includes.map(inc => <li key={inc}>{inc}</li>)}
        </ul>
        <div className="uc-pkg-uc-view-details">View details</div>
      </div>
      <div className="uc-pkg-modal-card-uc-imgbox">
        <img
          src={p.image || category?.image || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&q=80&fit=crop"}
          alt={p.name}
          className="uc-pkg-uc-img"
          onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&q=80&fit=crop"; }}
        />
        <div className="uc-pkg-uc-add-wrap" onClick={(e) => e.stopPropagation()}>
          {getCartCount(p.id) > 0 ? (
            <div className="uc-swiggy-qty">
              <button onClick={() => removeFromCart(p.id)}>-</button>
              <span>{getCartCount(p.id)}</span>
              <button onClick={() => addToCart(p)}>+</button>
            </div>
          ) : (
            <button className="uc-btn-add-swiggy" onClick={() => addToCart(p)}>Add</button>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="uc-modal-overlay" onClick={onClose}>
      <motion.div
        className="uc-pkg-modal"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
      >
        <button className="uc-pkg-modal-close" onClick={onClose}><X size={20} /></button>

        <div className="uc-pkg-modal-header">
          <div className="uc-pkg-modal-hero">
            <img src={category.image} alt={category.name} />
            <div className="uc-pkg-modal-hero-overlay">
              <h2>{category.name}</h2>
              <p>{category.desc}</p>
            </div>
          </div>
        </div>

        <div className="uc-pkg-modal-split" style={{ display: 'flex', flexDirection: 'row', gap: 0 }}>
          {/* Left Sidebar: Individual Services */}
          <div className="uc-pkg-sidebar" style={{ width: '35%', borderRight: '1px solid #e2e8f0', paddingRight: '1.5rem', overflowY: 'auto' }}>
            <h3 className="uc-pkg-sidebar-title" style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#1e293b', fontWeight: 900 }}>Individual Services</h3>
            <div className="uc-pkg-related-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {relatedServices.map((s, idx) => (
                <div key={s.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <img
                    src={s.image || s.img || category?.image || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100&q=80&fit=crop"}
                    alt={s.name}
                    style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100&q=80&fit=crop"; }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.2, marginBottom: '0.2rem' }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>{s.priceStr || (BOOKING_CURRENCY_SYMBOL + '499')} • {s.duration || '1 hr'}</div>

                    {getCartCount(s.id) > 0 ? (
                      <div className="uc-swiggy-qty" style={{ width: 80, height: 28, fontSize: '0.8rem' }}>
                        <button style={{ padding: '0 0.5rem' }} onClick={() => removeFromCart(s.id)}>-</button>
                        <span>{getCartCount(s.id)}</span>
                        <button style={{ padding: '0 0.5rem' }} onClick={() => addToCart({ ...s, image: s.image || s.img, price: s.price || 499 })}>+</button>
                      </div>
                    ) : (
                      <button className="uc-btn-add-swiggy" style={{ padding: '0.3rem 1rem', fontSize: '0.75rem' }} onClick={() => addToCart({ ...s, image: s.image || s.img, price: s.price || 499 })}>ADD</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Content: Packages */}
          <div className="uc-pkg-content" style={{ width: '65%', paddingLeft: '1.5rem', overflowY: 'auto' }}>
            <h3 className="uc-pkg-content-title" style={{ fontSize: '1.4rem', marginBottom: '1rem', color: '#1e293b', fontWeight: 900 }}>Packages & Bundles</h3>

            <div className="uc-pkg-filter-row">
              {["All", "Standard", "Premium"].map(f => (
                <button
                  key={f}
                  className={`uc-pkg-filter-pill ${activeFilter === f ? "active" : ""}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="uc-pkg-modal-list">
              {filteredPackages.map((p, i) => renderCard(p, i))}
            </div>
          </div>
        </div>

        {cart.length > 0 && (
          <motion.div
            className="uc-pkg-modal-cart-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="uc-cart-bar-left">
              <span className="uc-cart-bar-items">{cart.reduce((a, c) => a + c.quantity, 0)} items</span>
              <span className="uc-cart-bar-price">{BOOKING_CURRENCY_SYMBOL}{cart.reduce((a, c) => a + (c.price * c.quantity), 0)}</span>
            </div>
            <button className="uc-cart-bar-btn" onClick={onCheckout}>
              Proceed to Checkout <ChevronRight size={16} />
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STYLES
   ───────────────────────────────────────────────────────────────────────── */

function BkStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Outfit:wght@400;500;600;700;800;900&display=swap');

      @keyframes bk-spin { to { transform:rotate(360deg); } }
      .spin-icon { animation: bk-spin 0.8s linear infinite; display:inline-block; }

      /* ── Root ── */
      .uc-root {
        min-height: 100vh;
        background: #ffffff;
        font-family: 'Plus Jakarta Sans', sans-serif;
        color: #1e293b;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
      }

      /* ── Nav ── */
      .uc-nav {
        position: sticky; top:0; z-index:100;
        background: rgba(255,255,255,0.97);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid #e2e8f0;
        padding: 0.65rem 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .uc-nav-left { display:flex; align-items:center; gap:2rem; }
      .uc-nav-links { display:none; }
      @media (min-width: 900px) {
        .uc-nav-links { display:flex; gap:1.5rem; font-size:0.85rem; font-weight:700; color:#475569; }
        .uc-nav-links span { cursor:pointer; }
        .uc-nav-links span:hover { color:#1e293b; }
      }
      .uc-nav-center {
        display:flex; flex:1; gap:1rem; justify-content:flex-end; margin-right: 1.5rem;
      }
      .uc-location-selector { display:none; position: relative; }
      @media (min-width: 600px) {
        .uc-location-selector {
          display:flex; align-items:center; gap:0.4rem;
          background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px;
          padding:0.4rem 0.75rem; cursor:pointer;
          max-width:200px; position:relative;
        }
      }
      .uc-loc-text { font-size:0.75rem; font-weight:600; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .uc-feature-carousel {
        position: relative;
        width: 100%;
        height: 520px;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0,0,0,0.08);
      }
      .uc-feature-slide {
        position: absolute;
        inset: 0;
      }
      .uc-feature-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .uc-feature-overlay {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        padding: 5rem 2rem 2rem;
        background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
        color: white;
      }
      .uc-feature-text h3 {
        font-family: 'Outfit', sans-serif;
        font-size: 2rem;
        margin: 0 0 0.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .uc-feature-text p {
        font-size: 1.05rem;
        margin: 0;
        opacity: 0.9;
      }

      /* ── Nav Search Bar ── */
      .uc-nav-search {
        display: flex; align-items: center; gap: 0.5rem;
        background: #f8fafc; border: 1.5px solid #e2e8f0;
        border-radius: 10px; padding: 0.42rem 0.85rem;
        width: 260px; transition: border-color 0.2s, box-shadow 0.2s;
        flex-shrink: 0;
      }
      .uc-nav-search:focus-within {
        border-color: #7C3AED40; box-shadow: 0 0 0 3px #7C3AED12;
      }
      .uc-nav-search input {
        border: none; background: transparent; outline: none;
        font-size: 0.8rem; width: 100%; color: #1e293b;
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      .uc-nav-search input::placeholder { color: #94a3b8; }
      .uc-nav-right-icons { display:flex; align-items:center; gap:1.25rem; height:100%; }
      .uc-cart-icon, .uc-profile-icon {
        position:relative; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        width:36px; height:36px;
        border-radius: 8px;
        transition: background 0.15s;
      }
      .uc-cart-icon:hover, .uc-profile-icon:hover { background: #f1f5f9; }
      .uc-cart-badge {
        position:absolute; top:-4px; right:-6px;
        background:#ef4444; color:white; font-size:0.6rem; font-weight:800;
        width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center;
        line-height:1;
      }
      .uc-nav-summary {
        background: rgba(255,255,255,0.95); border-bottom: 1px solid #e2e8f0;
        padding: 0.5rem 1.5rem; position: sticky; top: 60px; z-index: 99;
      }

      /* ── Progress ── */
      .uc-progress-wrap {
        background: white;
        border-bottom: 1px solid #f1f5f9;
        padding: 0.5rem 1.5rem 0.6rem;
      }
      .uc-stepbar-scroll {
        overflow-x: auto;
        scrollbar-width: none;
        margin-top: 0.5rem;
      }
      .uc-stepbar-scroll::-webkit-scrollbar { display:none; }
      .uc-stepbar {
        display: flex;
        align-items: center;
        gap: 0;
        min-width: max-content;
        max-width: 680px;
        margin: 0 auto;
      }
      .uc-sb-step {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        opacity: 0.4;
        transition: opacity 0.3s;
      }
      .uc-sb-step.uc-sb-done, .uc-sb-step.uc-sb-active { opacity:1; }
      .uc-sb-dot {
        width: 22px; height:22px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #64748b;
        font-size: 0.65rem;
        font-weight: 800;
        display: flex; align-items:center; justify-content:center;
        transition: all 0.3s;
      }
      .uc-sb-done .uc-sb-dot { background:#10B981; color:white; }
      .uc-sb-active .uc-sb-dot { background:#7C3AED; color:white; box-shadow:0 0 0 3px #7C3AED30; }
      .uc-sb-label {
        font-size: 0.65rem;
        font-weight: 700;
        color: #64748b;
        white-space: nowrap;
      }
      .uc-sb-active .uc-sb-label { color:#7C3AED; }
      .uc-sb-done .uc-sb-label  { color:#10B981; }
      .uc-sb-line {
        flex: 1; height:2px;
        background: #e2e8f0;
        margin: 0 0.4rem;
        min-width: 20px;
        transition: background 0.4s;
      }
      .uc-sb-line-done { background: #10B981; }

      /* ── Main ── */
      .uc-main {
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #e2e8f0 transparent;
        background: #f8fafc;
      }
      .uc-step-container {
        max-width: 550px;
        margin: 2.5rem auto;
        padding: 2.5rem 2.25rem 3.5rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.04);
      }

      .uc-home-wrapper {
        display: flex;
        flex-direction: column;
      }
      .uc-home-right { display: none; }
      @media (min-width: 768px) {
        .uc-home-wrapper {
          flex-direction: row;
          width: 100%;
          margin: 0;
          align-items: stretch;
          gap: 3rem;
          padding-right: 2rem;
        }
        .uc-home-left { flex: 1.2; min-width: 0; }
        .uc-home-right {
          display: block;
          flex: 0.8;
          padding-top: 4rem;
        }
      }
      .uc-hc-img-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        position: sticky;
        top: 100px;
      }
      .uc-hc-img {
        width: 100%;
        height: 180px;
        object-fit: cover;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      }
      .uc-hc-img-large {
        grid-column: span 2;
        height: 240px;
      }
      .uc-hc-badge {
        position: absolute;
        top: -15px; left: -15px;
        background: white;
        padding: 0.5rem 1rem;
        border-radius: 99px;
        font-weight: 800;
        font-size: 0.8rem;
        color: #1e293b;
        box-shadow: 0 10px 30px rgba(0,0,0,0.12);
        z-index: 10;
        border: 1px solid #f1f5f9;
      }

      /* ── HERO ── */
      .uc-hero {
        background: transparent;
        position: relative;
        overflow: hidden;
        padding: 4rem 1.5rem 3.5rem;
      }
      .uc-hero::before { display: none; }
      .uc-hero-inner {
        position: relative;
        max-width: 100%;
        margin: 0;
        text-align: left;
        z-index: 1;
      }
      .uc-hero-tag {
        display:inline-block;
        font-size: 0.85rem;
        font-weight: 700;
        color: #475569;
        margin-bottom: 1rem;
      }
      .uc-hero-h1 {
        font-family: 'Outfit', sans-serif;
        font-size: clamp(2rem, 5vw, 3.2rem);
        font-weight: 900;
        color: #0f172a;
        line-height: 1.15;
        margin: 0 0 1rem;
        letter-spacing: -0.02em;
      }
      .uc-hero-rotate {
        display: inline-block;
        color: #7C3AED;
      }
      .uc-hero-sub {
        color: #64748b;
        font-size: 0.95rem;
        font-weight: 500;
        margin-bottom: 2rem;
      }

      /* ── Search ── */
      .uc-search-bar {
        position: relative;
        max-width: 560px;
        margin: 0 0 1.5rem;
      }
      .uc-search-icon {
        position:absolute; left:1.1rem; top:50%;
        transform:translateY(-50%);
        color: #94a3b8;
        pointer-events:none;
      }
      .uc-search-input {
        width:100%; box-sizing:border-box;
        background: #f8fafc;
        border: none;
        border-radius: 16px;
        padding: 1rem 3rem 1rem 3.2rem;
        font-size: 0.95rem;
        font-family: 'Plus Jakarta Sans', sans-serif;
        color: #1e293b;
        outline: none;
        box-shadow: none;
      }
      .uc-search-clear {
        position:absolute; right:1rem; top:50%;
        transform:translateY(-50%);
        background:none; border:none; cursor:pointer;
        color:#94a3b8; display:flex; align-items:center;
      }
      .uc-trust-row {
        display:flex; align-items:center; justify-content:flex-start;
        flex-wrap:wrap; gap:0.5rem 1.25rem;
        font-size: 0.72rem;
        font-weight: 700;
        color: #475569;
      }
      .uc-trust-row span {
        display:flex; align-items:center; gap:0.3rem;
      }

      /* ── Category Grid ── */
      .uc-section {
        width: 100%;
        padding: 2.5rem 1.5rem;
      }
      .uc-section-header { margin-bottom: 1.5rem; }
      .uc-section-title {
        font-family: 'Outfit', sans-serif;
        font-size: 1.6rem;
        font-weight: 900;
        color: #1e293b;
        margin: 0 0 0.3rem;
        letter-spacing: -0.02em;
      }
      .uc-section-sub {
        font-size: 0.88rem;
        color: #64748b;
        font-weight: 500;
        margin: 0 0 1rem;
      }
      .uc-cat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 1.25rem;
      }
      .uc-cat-card {
        display: flex;
        flex-direction: column;
        background: white;
        border: 1px solid #f1f5f9;
        border-radius: 16px;
        padding: 0;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        overflow: hidden;
      }
      .uc-cat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 30px rgba(0,0,0,0.12);
        border-color: #e2e8f0;
      }
      .uc-cat-img-wrap {
        position: relative;
        width: 100%;
        height: 130px;
        overflow: hidden;
      }
      .uc-cat-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .uc-cat-overlay {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.25s;
      }
      .uc-cat-card:hover .uc-cat-overlay {
        opacity: 1;
      }
      .uc-cat-btn {
        background: white; color: #1e293b;
        font-weight: 700; font-size: 0.85rem;
        padding: 0.6rem 1.4rem; border-radius: 99px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateY(15px); transition: transform 0.25s;
      }
      .uc-cat-card:hover .uc-cat-btn {
        transform: translateY(0);
      }
      .uc-cat-body { padding: 1.25rem; width: 100%; box-sizing: border-box; }
      .uc-cat-name { font-size:0.92rem; font-weight:800; color:#1e293b; margin-bottom:0.2rem; }
      .uc-cat-desc { font-size:0.72rem; color:#64748b; margin-bottom:0.35rem; }
      .uc-cat-meta { display:flex; align-items:center; gap:0.75rem; }
      .uc-cat-jobs { font-size:0.65rem; color:#94a3b8; font-weight:600; }
      .uc-cat-arrow { color:#cbd5e1; flex-shrink:0; }
      .uc-cat-card:hover .uc-cat-arrow { color:#7C3AED; }

      /* ── How It Works ── */
      .uc-how {
        background: linear-gradient(135deg, #faf5ff, #f0fdf4);
        padding: 3rem 1.5rem;
      }
      .uc-how-grid {
        display:grid;
        grid-template-columns: repeat(auto-fit, minmax(240px,1fr));
        gap:1.5rem;
        max-width:900px;
        margin:1.5rem auto 0;
      }
      .uc-how-card {
        background:white;
        border-radius:24px;
        padding:2.5rem 1.5rem;
        text-align:center;
        box-shadow:0 10px 40px rgba(0,0,0,0.04);
        position:relative;
        transition: transform 0.2s;
      }
      .uc-how-card:hover { transform: translateY(-4px); }
      .uc-how-number {
        position:absolute; top:-16px; left:50%; transform:translateX(-50%);
        width:32px; height:32px; border-radius:50%;
        background:#1e293b;
        color:white; font-size:0.9rem; font-weight:900;
        display:flex; align-items:center; justify-content:center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      }
      .uc-how-icon-wrapper {
        width: 64px; height: 64px;
        margin: 0 auto 1.25rem;
        border-radius: 16px;
        background: #f8fafc;
        display: flex; align-items: center; justify-content: center;
        color: #7C3AED;
      }
      .uc-how-title { font-size:1.1rem; font-weight:800; color:#1e293b; margin-bottom:0.5rem; }
      .uc-how-desc  { font-size:0.85rem; color:#64748b; line-height:1.6; }

      /* ── Reviews ── */
      .uc-reviews-section {
        padding: 3rem 1.5rem;
        max-width:1200px;
        margin:0 auto;
      }
      .uc-reviews-grid {
        display:grid;
        grid-template-columns: repeat(auto-fill, minmax(260px,1fr));
        gap:1.5rem;
        margin-top:1.5rem;
      }
      .uc-review-card {
        background:white;
        border:1px solid #f1f5f9;
        border-radius:20px;
        padding:1.5rem;
        box-shadow:0 10px 30px rgba(0,0,0,0.03);
        position: relative;
      }
      .uc-review-top {
        display:flex; align-items:center; gap:1rem; margin-bottom:1rem;
      }
      .uc-review-avatar-img {
        width: 48px; height: 48px; border-radius: 50%;
        object-fit: cover;
      }
      .uc-review-name { font-weight: 800; color: #1e293b; font-size: 0.95rem; }
      .uc-review-ago { font-size: 0.75rem; color: #94a3b8; margin-top: 0.1rem; }
      .uc-review-text { font-size:0.85rem; color:#475569; line-height:1.6; font-style: italic; }

      /* ── Step Pages ── */
      .uc-step-container {
        max-width: 680px;
        margin: 1.5rem auto 3rem;
        padding: 2.25rem 2.5rem;
        background: white;
        border-radius: 24px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03);
        border: 1px solid #f1f5f9;
      }
      .uc-step-page {
        display:flex;
        flex-direction:column;
        gap:0;
      }
      .uc-step-back {
        display:inline-flex; align-items:center; gap:0.35rem;
        font-size:0.8rem; font-weight:700; color:#64748b;
        cursor:pointer; margin-bottom:1.25rem;
        transition:color 0.15s;
        width:fit-content;
      }
      .uc-step-back:hover { color:#7C3AED; }
      .uc-step-hero-bar {
        display:flex; align-items:center; gap:1rem;
        border-radius:16px; padding:1.25rem;
        margin-bottom:1.5rem;
        color:white;
      }
      .uc-step-hero-name { font-size:1.1rem; font-weight:800; color:white; margin-bottom:0.25rem; }
      .uc-step-h2 {
        font-family:'Outfit',sans-serif;
        font-size:1.5rem; font-weight:900;
        color:#1e293b; margin:0 0 0.3rem;
        letter-spacing:-0.02em;
      }
      .uc-step-sub { font-size:0.82rem; color:#64748b; margin:0 0 1.5rem; font-weight:500; }

      /* ── Package Cards ── */
      .uc-pkg-grid {
        display:grid;
        grid-template-columns: repeat(auto-fill, minmax(220px,1fr));
        gap:1rem;
        margin-bottom:1.5rem;
      }
      .uc-pkg-card {
        background:white;
        border:2px solid #e2e8f0;
        border-radius:18px;
        padding:1.25rem;
        cursor:pointer;
        position:relative;
        transition:all 0.2s ease;
        box-shadow:0 2px 8px rgba(0,0,0,0.04);
      }
      .uc-pkg-card:hover { border-color:#7C3AED; box-shadow:0 8px 24px rgba(124,58,237,0.12); }
      .uc-pkg-card--sel {
        border-color:#7C3AED;
        background:#faf5ff;
        box-shadow:0 8px 28px rgba(124,58,237,0.18);
      }
      .uc-pkg-card--pop { border-color:#7C3AED; }
      .uc-pkg-tag {
        position:absolute; top:-1px; left:50%; transform:translateX(-50%);
        color:white; font-size:0.65rem; font-weight:800;
        padding:3px 12px; border-radius:0 0 10px 10px;
        white-space:nowrap; letter-spacing:0.03em;
      }
      .uc-pkg-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; margin-top:0.25rem; }
      .uc-pkg-name { font-size:0.95rem; font-weight:800; color:#1e293b; margin-bottom:0.25rem; }
      .uc-pkg-dur  { display:flex; align-items:center; gap:0.3rem; font-size:0.68rem; color:#94a3b8; font-weight:600; }
      .uc-pkg-price-col { text-align:right; }
      .uc-pkg-price { font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:900; color:#7C3AED; line-height:1; }
      .uc-pkg-price-note { font-size:0.62rem; color:#94a3b8; font-weight:600; }
      .uc-pkg-divider { height:1px; background:#f1f5f9; margin:0.75rem 0; }
      .uc-pkg-list { display:flex; flex-direction:column; gap:0.4rem; }
      .uc-pkg-item { display:flex; align-items:flex-start; gap:0.4rem; font-size:0.75rem; font-weight:600; }
      .uc-pkg-yes { color:#059669; }
      .uc-pkg-no  { color:#94a3b8; text-decoration:line-through; }
      .uc-pkg-radio {
        width:20px; height:20px; border-radius:50%;
        border:2px solid #e2e8f0;
        display:flex; align-items:center; justify-content:center;
        margin-top:0.75rem; margin-left:auto;
        transition:border-color 0.2s;
      }
      .uc-pkg-radio--sel { border-color:#7C3AED; background:#7C3AED; }
      .uc-pkg-radio-dot { width:8px; height:8px; border-radius:50%; background:white; }

      /* ── Schedule ── */
      .uc-date-section, .uc-time-section { margin-bottom:1.5rem; }
      .uc-subsection-label {
        display:flex; align-items:center; gap:0.4rem;
        font-size:0.78rem; font-weight:800; color:#475569;
        text-transform:uppercase; letter-spacing:0.04em;
        margin-bottom:0.75rem;
      }
      .uc-date-scroll {
        display:flex; gap:0.65rem; overflow-x:auto;
        scrollbar-width:none;
        padding: 14px 6px 12px;
        scroll-behavior: smooth;
      }
      .uc-date-scroll::-webkit-scrollbar { display:none; }
      .uc-date-pill {
        display:flex; flex-direction:column; align-items:center;
        min-width:68px; padding:0.65rem 0.5rem;
        border:2px solid #e2e8f0; border-radius:14px;
        background:white; cursor:pointer;
        font-family:inherit; position:relative;
        transition:all 0.15s ease;
        gap:0.15rem; flex-shrink:0;
      }
      .uc-date-pill:hover { border-color:#7C3AED; }
      .uc-date-pill--sel { border-color:#7C3AED; background:#7C3AED; }
      .uc-date-today-tag {
        position:absolute; top:-10px; left:50%; transform:translateX(-50%);
        background:#10B981; color:white; font-size:0.58rem;
        font-weight:800; padding:2px 8px; border-radius:99px; white-space:nowrap;
        box-shadow:0 2px 5px rgba(16,185,129,0.3);
      }
      .uc-date-day { font-size:0.65rem; font-weight:700; color:#94a3b8; }
      .uc-date-pill--sel .uc-date-day { color:rgba(255,255,255,0.8); }
      .uc-date-num { font-family:'Outfit',sans-serif; font-size:1.2rem; font-weight:900; color:#1e293b; line-height:1; }
      .uc-date-pill--sel .uc-date-num { color:white; }
      .uc-date-mon { font-size:0.6rem; font-weight:700; color:#94a3b8; text-transform:uppercase; }
      .uc-date-pill--sel .uc-date-mon { color:rgba(255,255,255,0.7); }
      .uc-time-group { margin-bottom:1rem; }
      .uc-time-period-label { font-size:0.72rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.5rem; }
      .uc-time-slots { display:flex; flex-wrap:wrap; gap:0.4rem; }
      .uc-time-slot {
        padding:0.45rem 0.85rem;
        border:1.5px solid #e2e8f0;
        border-radius:10px;
        background:white;
        font-size:0.78rem;
        font-weight:600;
        color:#475569;
        cursor:pointer;
        font-family:inherit;
        transition:all 0.15s;
      }
      .uc-time-slot:hover { border-color:#7C3AED; color:#7C3AED; }
      .uc-time-slot--sel { background:#7C3AED; border-color:#7C3AED; color:white; font-weight:700; }

      /* ── Login ── */
      .uc-login-page { padding-top:0.5rem; }
      .uc-login-center { text-align:center; margin-bottom:1.5rem; }
      .uc-login-shield {
        width:72px; height:72px; border-radius:20px;
        background:#7C3AED15;
        display:flex; align-items:center; justify-content:center;
        margin:0 auto 1rem;
      }
      .uc-login-trust-row {
        display:flex; align-items:center; justify-content:center; flex-wrap:wrap;
        gap:0.4rem 0.85rem; margin-bottom:1.5rem;
        font-size:0.68rem; font-weight:700; color:#64748b;
      }
      .uc-login-trust-row span {
        display:flex; align-items:center; gap:0.25rem;
        background:#f8fafc; border:1px solid #e2e8f0;
        border-radius:99px; padding:3px 8px;
      }
      .uc-otp-row { display:flex; gap:0.75rem; justify-content:center; margin:1.5rem 0; }
      .uc-otp-box {
        width: 72px; height: 80px;
        border: 2px solid #e2e8f0;
        border-radius: 16px;
        font-family: 'Outfit', sans-serif;
        font-size: 2.2rem; font-weight: 900;
        text-align: center; color: #1e293b;
        outline: none;
        background: #f8fafc;
        transition: all 0.2s;
        caret-color: #7C3AED;
      }
      .uc-otp-box:focus { border-color: #7C3AED; background: white; box-shadow: 0 0 0 4px #7C3AED15; }
      .uc-otp-filled { border-color: #7C3AED; background: #faf5ff; color: #7C3AED; }
      .uc-resend { text-align:center; margin-top:1rem; }
      .uc-dev-banner {
        display:flex; align-items:center; justify-content:center; gap:0.4rem;
        background:#fffbeb; border:1px solid #fde68a;
        border-radius:10px; padding:0.5rem 0.85rem;
        font-size:0.78rem; font-weight:600; color:#92400e;
        margin-bottom:0.75rem;
      }
      .uc-login-success {
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        padding:3rem 1rem; gap:0.75rem; text-align:center;
      }
      .uc-success-check {
        width:90px; height:90px; border-radius:50%;
        background:linear-gradient(135deg,#10B981,#059669);
        display:flex; align-items:center; justify-content:center;
        margin-bottom:0.5rem;
      }
      .uc-success-title { font-family:'Outfit',sans-serif; font-size:1.6rem; font-weight:900; color:#1e293b; }
      .uc-success-sub   { font-size:0.88rem; color:#64748b; font-weight:600; }

      /* ── Form ── */
      .uc-form { display:flex; flex-direction:column; gap:1rem; margin-bottom:1.5rem; }
      .uc-field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
      @media(max-width:560px) { .uc-field-row { grid-template-columns:1fr; } }
      .uc-field { display:flex; flex-direction:column; gap:0.35rem; }
      .uc-label { font-size:0.75rem; font-weight:700; color:#475569; }
      .uc-input-wrap { position:relative; }
      .uc-field-icon {
        position:absolute; left:0.9rem; top:50%;
        transform:translateY(-50%);
        color:#94a3b8; pointer-events:none;
      }
      .uc-input {
        width:100%; box-sizing:border-box;
        background:#f1f5f9;
        border:1.5px solid transparent;
        border-radius:12px;
        padding:0.85rem 1rem 0.85rem 2.75rem;
        font-size:0.9rem;
        font-weight:600;
        font-family:'Plus Jakarta Sans',sans-serif;
        color:#1e293b;
        outline:none;
        transition:all 0.2s;
      }
      .uc-input:focus { border-color:#7C3AED; background:white; box-shadow:0 0 0 4px #7C3AED15; }
      .uc-textarea {
        width:100%; box-sizing:border-box;
        background:#f1f5f9;
        border:1.5px solid transparent;
        border-radius:12px;
        padding:0.85rem 1rem;
        font-size:0.9rem;
        font-weight:600;
        font-family:'Plus Jakarta Sans',sans-serif;
        color:#1e293b;
        outline:none;
        resize:vertical;
        transition:all 0.2s;
      }
      .uc-textarea:focus { border-color:#7C3AED; background:white; box-shadow:0 0 0 4px #7C3AED15; }

      .uc-photo-zone {
        border:2px dashed #e2e8f0;
        border-radius:14px;
        padding:1.5rem;
        cursor:pointer;
        text-align:center;
        display:flex; flex-direction:column; align-items:center; gap:0.5rem;
        transition:border-color 0.2s;
        background:#fafbfc;
      }
      .uc-photo-zone:hover { border-color:#7C3AED; }
      .uc-photo-text { font-size:0.82rem; font-weight:600; color:#475569; }
      .uc-photo-hint { font-size:0.7rem; color:#94a3b8; }
      .uc-photo-preview { position:relative; width:100%; }
      .uc-photo-preview img { width:100%; height:160px; object-fit:cover; border-radius:10px; }
      .uc-photo-change {
        display:flex; align-items:center; gap:0.35rem;
        margin-top:0.5rem; font-size:0.75rem; font-weight:700; color:#7C3AED; cursor:pointer;
        justify-content:center;
      }

      /* ── Confirm ── */
      .uc-confirm-layout {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:1.25rem;
        align-items:start;
      }
      @media(max-width:640px) { .uc-confirm-layout { grid-template-columns:1fr; } }
      .uc-summary-card { background:white; border:1px solid #e2e8f0; border-radius:18px; overflow:hidden; }
      .uc-summary-hero {
        display:flex; align-items:center; gap:1rem;
        padding:1.1rem;
      }
      .uc-summary-body { padding:1rem; display:flex; flex-direction:column; gap:0.5rem; }
      .uc-summary-row {
        display:flex; align-items:flex-start; gap:0.5rem;
        font-size:0.78rem; font-weight:600; color:#475569;
      }
      .uc-price-box { border-top:1px solid #f1f5f9; padding:1rem; }
      .uc-price-row { display:flex; justify-content:space-between; font-size:0.78rem; font-weight:600; color:#64748b; margin-bottom:0.4rem; }
      .uc-price-free {}
      .uc-price-total {
        display:flex; justify-content:space-between;
        font-size:1rem; font-weight:900; color:#1e293b;
        border-top:1px solid #e2e8f0; padding-top:0.5rem; margin-top:0.25rem;
      }
      .uc-confirm-includes { display:flex; flex-direction:column; gap:0.6rem; }
      .uc-includes-title { font-size:0.78rem; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.25rem; }
      .uc-includes-row { display:flex; align-items:flex-start; gap:0.4rem; font-size:0.8rem; color:#475569; font-weight:600; }
      .uc-guarantee-box {
        display:flex; align-items:flex-start; gap:0.75rem;
        background:#faf5ff; border:1px solid #DDD6FE;
        border-radius:12px; padding:0.85rem;
        margin:0.5rem 0;
      }
      .uc-agree {
        display:flex; align-items:flex-start; gap:0.5rem;
        font-size:0.75rem; color:#64748b; cursor:pointer; line-height:1.5;
      }
      .uc-error {
        display:flex; align-items:center; gap:0.4rem;
        background:#fef2f2; border:1px solid #fecaca;
        border-radius:10px; padding:0.6rem 0.85rem;
        font-size:0.78rem; color:#dc2626; font-weight:600;
        margin:0.5rem 0;
      }

      /* ── Success Page ── */
      .uc-success-page {
        max-width:520px;
        margin:3rem auto;
        text-align:center;
        padding:1rem;
        display:flex; flex-direction:column; align-items:center; gap:1rem;
      }
      .uc-success-circle {
        width:100px; height:100px; border-radius:50%;
        background:linear-gradient(135deg,#10B981,#059669);
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 16px 40px rgba(16,185,129,0.35);
      }
      .uc-success-h2 {
        font-family:'Outfit',sans-serif;
        font-size:1.75rem; font-weight:900; color:#1e293b; margin:0;
      }
      .uc-success-desc { font-size:0.88rem; color:#64748b; max-width:340px; }
      .uc-success-ref {
        background:white; border:1px solid #e2e8f0;
        border-radius:16px; padding:1.25rem 2rem;
        box-shadow:0 4px 16px rgba(0,0,0,0.06);
      }
      .uc-success-timeline {
        display:flex; flex-direction:column; gap:0; width:100%;
        background:white; border:1px solid #e2e8f0;
        border-radius:16px; overflow:hidden;
        box-shadow:0 2px 8px rgba(0,0,0,0.04);
      }
      .uc-tl-item {
        display:flex; align-items:center; gap:0.75rem;
        padding:0.75rem 1.25rem;
        border-bottom:1px solid #f8fafc;
        font-size:0.82rem; font-weight:600; color:#94a3b8;
      }
      .uc-tl-item:last-child { border-bottom:none; }
      .uc-tl-done { color:#1e293b; }
      .uc-tl-icon { font-size:1rem; width:24px; text-align:center; }
      .uc-tl-label { flex:1; }

      /* ── Buttons ── */
      .uc-btn-primary {
        display:inline-flex; align-items:center; justify-content:center; gap:0.45rem;
        background:linear-gradient(135deg,#7C3AED,#6d28d9);
        color:white; border:none; border-radius:14px;
        padding:0.85rem 1.75rem;
        font-size:0.9rem; font-weight:800;
        font-family:'Plus Jakarta Sans',sans-serif;
        cursor:pointer; transition:all 0.2s ease;
        box-shadow:0 4px 16px rgba(124,58,237,0.3);
        letter-spacing:-0.01em;
      }
      .uc-btn-primary:hover:not(:disabled) {
        transform:translateY(-2px);
        box-shadow:0 8px 28px rgba(124,58,237,0.4);
        filter:brightness(1.08);
      }
      .uc-btn-primary:active { transform:translateY(0); }
      .uc-btn-primary:disabled { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
      .uc-btn-full { width:100%; }

      .uc-btn-outline {
        display:inline-flex; align-items:center; gap:0.4rem;
        background:white; color:#7C3AED;
        border:2px solid #7C3AED;
        border-radius:14px; padding:0.75rem 1.5rem;
        font-size:0.88rem; font-weight:700;
        font-family:inherit; cursor:pointer;
        transition:all 0.2s ease;
      }
      .uc-btn-outline:hover { background:#faf5ff; }

      .uc-link {
        background:none; border:none;
        color:#7C3AED; font-weight:700; font-size:inherit;
        font-family:inherit; cursor:pointer; text-decoration:underline;
        padding:0;
      }

      .uc-step-footer { padding-top:0.5rem; }

      /* ── Footer ── */
      .uc-footer {
        background:white; border-top:1px solid #e2e8f0;
        padding:0.75rem 1.5rem;
        display:flex; align-items:center; justify-content:center;
        gap:0.4rem; flex-wrap:wrap;
        font-size:0.72rem; font-weight:600; color:#94a3b8;
      }
      /* ── Package Modal ── */
      .uc-modal-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(4px);
        z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        padding: 1.5rem;
      }
      .uc-pkg-modal {
        background: white;
        border-radius: 24px;
        width: 100%; max-width: 960px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      }
      .uc-pkg-modal-close {
        position: absolute; top: 1rem; right: 1rem;
        background: rgba(255,255,255,0.9); border: none;
        width: 36px; height: 36px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 10; color: #1e293b;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .uc-pkg-modal-hero {
        position: relative; width: 100%; height: 200px;
        border-radius: 24px 24px 0 0; overflow: hidden;
      }
      .uc-pkg-modal-hero img {
        width: 100%; height: 100%; object-fit: cover;
      }
      .uc-pkg-modal-hero-overlay {
        position: absolute; inset: 0;
        background: linear-gradient(to top, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.2) 100%);
        display: flex; flex-direction: column; justify-content: flex-end;
        padding: 2rem; color: white;
      }
      .uc-pkg-modal-hero-overlay h2 { font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 800; margin: 0; }
      .uc-pkg-modal-hero-overlay p { margin: 0.2rem 0 0; color: rgba(255,255,255,0.85); font-weight: 500; font-size: 1rem; }
      .uc-pkg-modal-split {
        display: flex;
        flex-direction: row;
        background: #f8fafc;
        min-height: 400px;
      }
      .uc-pkg-sidebar {
        width: 300px;
        background: white;
        border-right: 1px solid #e2e8f0;
        padding: 2rem;
      }
      .uc-pkg-sidebar-title {
        font-size: 1.15rem; font-weight: 800; color: #1e293b; margin: 0 0 1.2rem;
      }
      .uc-pkg-related-list {
        list-style: none; padding: 0; margin: 0;
        display: flex; flex-direction: column; gap: 0.75rem;
      }
      .uc-pkg-sidebar-card {
        display: flex; align-items: center; gap: 12px;
        font-size: 0.85rem; font-weight: 700; color: #475569;
        cursor: pointer; padding: 0.5rem; border-radius: 12px;
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }
      .uc-pkg-sidebar-img {
        width: 40px; height: 40px; border-radius: 8px; object-fit: cover;
      }
      .uc-pkg-sidebar-card:hover {
        background: white; border-color: #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      }
      .uc-pkg-sidebar-card.uc-pkg-sidebar-active {
        background: #ede9fe; color: #7C3AED; border-color: #ddd6fe; box-shadow: 0 4px 12px rgba(124,58,237,0.1);
      }
      
      .uc-pkg-filter-row {
        display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 4px;
      }
      .uc-pkg-filter-pill {
        background: white; border: 1px solid #e2e8f0; color: #475569;
        padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.8rem; font-weight: 700;
        cursor: pointer; transition: all 0.2s; white-space: nowrap;
      }
      .uc-pkg-filter-pill:hover { background: #f8fafc; border-color: #cbd5e1; }
      .uc-pkg-filter-pill.active { background: #1e293b; color: white; border-color: #1e293b; }

      .uc-pkg-content {
        flex: 1;
        padding: 2rem;
      }
      .uc-pkg-content-title {
        font-size: 1.25rem; font-weight: 800; color: #1e293b; margin: 0 0 1.5rem;
      }
      .uc-pkg-modal-list {
        display: flex; flex-direction: column; gap: 1rem;
      }
      .uc-pkg-modal-card-h {
        background: white; border-radius: 16px;
        padding: 1.5rem; position: relative;
        border: 1px solid #e2e8f0;
        cursor: pointer; transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        display: flex; flex-direction: row; align-items: center; justify-content: space-between;
        gap: 1.5rem;
      }
      .uc-pkg-modal-card-h:hover {
        transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.06); border-color: #7C3AED;
      }
      .uc-pkg-modal-card-left { flex: 1; }
      .uc-pkg-modal-tags { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
      .uc-pkg-badge {
        font-size: 0.7rem; font-weight: 800; padding: 4px 10px; border-radius: 6px;
        color: white; text-transform: uppercase; letter-spacing: 0.05em;
      }
      .popular-badge { background: linear-gradient(135deg, #f59e0b, #d97706); }
      .value-badge { background: linear-gradient(135deg, #10b981, #059669); }
      
      .uc-pkg-modal-card-left h4 { margin: 0 0 0.4rem; font-size: 1.25rem; font-weight: 800; color: #1e293b; }
      .uc-pkg-modal-price-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
      .uc-pkg-modal-price { font-size: 1.4rem; font-weight: 900; color: #7C3AED; }
      .uc-pkg-modal-dur { font-size: 0.85rem; font-weight: 600; color: #64748b; display: flex; align-items: center; gap: 4px; }
      
      .uc-pkg-modal-inc-list { display: flex; flex-direction: column; gap: 0.4rem; }
      .uc-pkg-inc { font-size: 0.85rem; color: #475569; display: flex; align-items: flex-start; gap: 6px; line-height: 1.4; }
      .uc-pkg-inc svg { color: #10B981; flex-shrink: 0; margin-top: 2px; }
      
      .uc-pkg-modal-card-right { flex-shrink: 0; }
      .uc-btn-add { padding: 0.6rem 1.5rem; border-radius: 99px; }

      @media (max-width: 768px) {
        .uc-pkg-modal-split { flex-direction: column; }
        .uc-pkg-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #e2e8f0; }
        .uc-pkg-modal-card-h { flex-direction: column; align-items: flex-start; }
        .uc-pkg-modal-card-right { width: 100%; }
        .uc-btn-add { width: 100%; }
      }
      
      .uc-pkg-modal-card-uc {
        display: flex; justify-content: space-between; align-items: flex-start;
        padding: 1.5rem 0; border-bottom: 1px dashed #e2e8f0; gap: 1rem;
      }
      .uc-pkg-modal-card-uc:last-child { border-bottom: none; }
      
      .uc-uc-section-title {
        font-size: 1.5rem; font-weight: 900; color: #1e293b;
        margin-bottom: 1rem;
      }

      .uc-pkg-modal-card-uc-info { flex: 1; padding-right: 1rem; }
      .uc-pkg-uc-title { font-size: 1.15rem; font-weight: 800; color: #1e293b; margin-bottom: 0.2rem; }
      .uc-pkg-uc-rating { display: flex; align-items: center; font-size: 0.75rem; margin-bottom: 0.5rem; }
      .uc-pkg-uc-price { font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 1rem; }
      .uc-pkg-uc-dot { margin: 0 4px; color: #94a3b8; }
      .uc-pkg-uc-includes { margin: 0; padding-left: 1.2rem; margin-bottom: 1rem; color: #475569; font-size: 0.85rem; line-height: 1.5; }
      .uc-pkg-uc-includes li { margin-bottom: 0.25rem; }
      .uc-pkg-uc-view-details { color: #7C3AED; font-weight: 800; font-size: 0.85rem; cursor: pointer; }
      
      .uc-pkg-modal-card-uc-imgbox {
        position: relative; width: 120px; display: flex; flex-direction: column; align-items: center;
      }
      .uc-pkg-uc-img { width: 120px; height: 120px; border-radius: 12px; object-fit: cover; }
      .uc-pkg-uc-add-wrap {
        position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;
        background: white;
      }
      
      .uc-btn-add-swiggy {
        background: white; border: 1px solid #e2e8f0; color: #7C3AED;
        font-weight: 800; padding: 0.4rem 1.8rem; border-radius: 8px;
        cursor: pointer; transition: all 0.2s; 
        text-transform: uppercase; font-size: 0.85rem;
      }
      .uc-btn-add-swiggy:hover { background: #f8fafc; border-color: #cbd5e1; }
      
      .uc-swiggy-qty {
        display: flex; align-items: center; justify-content: space-between;
        background: white; border: 1px solid #7C3AED; color: #7C3AED;
        font-weight: 800; border-radius: 8px; overflow: hidden; width: 90px;
      }
      .uc-swiggy-qty button {
        background: transparent; border: none; color: #7C3AED; padding: 0.4rem 0.8rem;
        cursor: pointer; font-weight: 800; transition: background 0.2s;
      }
      .uc-swiggy-qty button:hover { background: #f3e8ff; }
      
      .uc-pkg-modal-cart-bar {
        position: sticky; bottom: 0; left: 0; right: 0;
        background: white; border-top: 1px solid #e2e8f0;
        padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center;
        box-shadow: 0 -10px 30px rgba(0,0,0,0.05); z-index: 10;
        border-radius: 0 0 24px 24px;
      }
      .uc-cart-bar-left { display: flex; flex-direction: column; }
      .uc-cart-bar-items { font-size: 0.8rem; font-weight: 700; color: #64748b; }
      .uc-cart-bar-price { font-size: 1.25rem; font-weight: 900; color: #1e293b; }
      
      .uc-cart-bar-btn {
        background: #7C3AED; color: white; border: none;
        padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 800;
        cursor: pointer; display: flex; align-items: center; gap: 8px;
        transition: background 0.2s;
      }
      .uc-cart-bar-btn:hover { background: #6D28D9; }

    `}</style>
  )
}
