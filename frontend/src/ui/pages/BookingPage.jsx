import React, { useState, useEffect, useRef, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
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
  apiFetchCustomerBookings, apiLogout
} from "../../api/authService.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { apiRequest } from "../../api/client.js"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";

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
  if (!window.google) {
    if (typeof onError === 'function') onError("Google login service is not ready yet. Please try again in a few seconds.");
    return;
  }

  try {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: "628867483502-e7snj6l150js2vpvkv70opo5h4aacgus.apps.googleusercontent.com",
      scope: "email profile openid",
      callback: (response) => {
        if (response && response.access_token) {
          if (typeof onSuccess === 'function') onSuccess(response.access_token);
        } else {
          if (typeof onError === 'function') onError("Google login cancelled or failed.");
        }
      },
      error_callback: (err) => {
        if (typeof onError === 'function') onError(err?.message || "Google login error");
      }
    });
    client.requestAccessToken();
  } catch (err) {
    if (typeof onError === 'function') onError(err?.message || "Failed to initialize Google login");
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
  { period: "Morning", icon: "🌅", slots: [{ t: "07:00", l: "7:00 AM" }, { t: "08:00", l: "8:00 AM" }, { t: "09:00", l: "9:00 AM" }, { t: "10:00", l: "10:00 AM" }, { t: "11:00", l: "11:00 AM" }] },
  { period: "Afternoon", icon: "☀️", slots: [{ t: "12:00", l: "12:00 PM" }, { t: "13:00", l: "1:00 PM" }, { t: "14:00", l: "2:00 PM" }, { t: "15:00", l: "3:00 PM" }, { t: "16:00", l: "4:00 PM" }] },
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
        <span style={{ color: "#7C3AED" }}>{totalItems} item{totalItems > 1 ? 's' : ''} · ₹{totalPrice}</span>
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
                <p className="uc-hero-tag">⭐ India's #1 Home Services Platform</p>
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
                <img src={featured[rotIdx].image} alt={featured[rotIdx].name} className="uc-feature-img" />
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
                <img src={cat.image} alt={cat.name} className="uc-cat-image" />
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
  const packages = (packagesData && packagesData[category?.id]) || PACKAGES[category?.id] || []

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
                  {pkg.popular ? "⭐ " : "✅ "}{pkg.tag}
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

function StepSchedule({ category, selectedDate, selectedTime, onDateChange, onTimeChange, onNext, onBack }) {
  const dateScrollRef = useRef()
  const canContinue = selectedDate && selectedTime

  return (
    <div className="uc-step-page">
      <div className="uc-step-back" onClick={onBack}><ArrowLeft size={16} /> Back</div>
      <h2 className="uc-step-h2">When should we come?</h2>
      <p className="uc-step-sub">Pick a date and time that works for you</p>

      {/* Date Scroll */}
      <div className="uc-date-section">
        <div className="uc-subsection-label"><Calendar size={14} /> Select Date</div>
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
        {TIME_SLOTS.map(group => (
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
    if (user && user.role === 'customer') {
      onVerified({
        verified: true,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Customer',
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

  const handleGoogleLogin = () => {
    openGoogleSignInPopup(
      async (accessToken) => {
        setLoading(true);
        setError("");
        try {
          const res = await apiRequest("/auth/customer/google/", {
            method: "POST",
            json: { access_token: accessToken }
          });
          if (res.success) {
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
            setError(res.detail || "Google login failed");
          }
        } catch (err) {
          setError(err?.body?.detail || "Google login failed");
        } finally {
          setLoading(false);
        }
      },
      (err) => setError(err)
    );
  };

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
            onClick={handleGoogleLogin}
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
          <div className="uc-success-sub">Welcome, {name} 👋</div>
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
                  <span>₹{c.price * c.quantity}</span>
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
              <span>₹{totalPrice}</span>
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
    { id: "cash", icon: "💵", label: "Cash on Service", sub: "Pay after service is completed", badge: "Most Popular", badgeColor: "#10B981", detail: ["No upfront payment", "Pay only on completion", "Any denomination accepted"] },
    { id: "online", icon: "💳", label: "Pay Online", sub: "UPI, Cards, Net Banking", badge: "Instant", badgeColor: "#7C3AED", detail: ["100% secure & encrypted", "Instant confirmation", "Invoice emailed immediately"] },
  ].filter(o => allowedMethods.includes(o.id))

  if (showOnlineSheet) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10020, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <motion.div initial={{ y: 400, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          style={{ background: 'white', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 540, paddingBottom: '2rem' }}>
          <div style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', borderRadius: '28px 28px 0 0', padding: '1.5rem 1.75rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Secure Payment</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', marginTop: 2 }}>₹{total.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Lock size={11} /> SSL Secured
              </div>
            </div>
            {payPhase === null && (
              <div style={{ display: 'flex', gap: 6, marginTop: '1rem' }}>
                {[{ id: 'upi', l: 'UPI' }, { id: 'card', l: 'Card' }, { id: 'netbanking', l: 'Net Banking' }, { id: 'wallet', l: 'Wallets' }].map(t => (
                  <button key={t.id} onClick={() => setPayTab(t.id)}
                    style={{
                      padding: '5px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, transition: 'all 0.2s',
                      background: payTab === t.id ? 'white' : 'rgba(255,255,255,0.18)', color: payTab === t.id ? '#7C3AED' : 'rgba(255,255,255,0.85)'
                    }}>{t.l}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding: '1.5rem 1.75rem' }}>
            {payPhase === 'processing' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: '1.5rem' }}><RefreshCw size={48} color="#7C3AED" /></motion.div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Processing Payment…</div>
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
                <div style={{ marginTop: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>✅ Amount ₹{total.toLocaleString('en-IN')} debited successfully</div>
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
            {payPhase === null && payTab === 'upi' && (
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
                  <Lock size={15} /> Pay ₹{total.toLocaleString('en-IN')}
                </button>
              </>
            )}
            {payPhase === null && payTab === 'card' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div><label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Card Number</label>
                    <input value={cardNum} onChange={e => setCardNum(e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim())} placeholder="1234 5678 9012 3456"
                      style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 10, padding: '0.8rem 1rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div><label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Name on Card</label>
                    <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Doe"
                      style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 10, padding: '0.8rem 1rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Expiry</label>
                      <input value={cardExp} onChange={e => setCardExp(e.target.value.replace(/\D/g, '').slice(0, 4).replace(/(.{2})/, '$1/'))} placeholder="MM/YY"
                        style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 10, padding: '0.8rem 1rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>CVV</label>
                      <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="•••" type="password"
                        style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 10, padding: '0.8rem 1rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>
                <button onClick={handleOnlinePayment} disabled={cardNum.length < 19 || !cardName || cardExp.length < 5 || cardCvv.length < 3}
                  style={{ width: '100%', padding: '1rem', background: (cardNum.length >= 19 && cardName && cardExp.length >= 5 && cardCvv.length >= 3) ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : '#e2e8f0', color: (cardNum.length >= 19 && cardName && cardExp.length >= 5 && cardCvv.length >= 3) ? 'white' : '#94a3b8', fontWeight: 800, fontSize: '0.95rem', border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Lock size={15} /> Pay ₹{total.toLocaleString('en-IN')}
                </button>
              </>
            )}
            {payPhase === null && payTab === 'netbanking' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                {['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'Yes Bank', 'PNB', 'BOB'].map(bank => (
                  <button key={bank} onClick={() => { setUpiId(bank); handleOnlinePayment(); }}
                    style={{ padding: '0.85rem', border: '2px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', background: 'white', fontWeight: 700, fontSize: '0.82rem', color: '#374151' }}>{bank}</button>
                ))}
              </div>
            )}
            {payPhase === null && payTab === 'wallet' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                {[{ name: 'Paytm Wallet', icon: '🟢' }, { name: 'Amazon Pay', icon: '🟠' }, { name: 'MobiKwik', icon: '🔵' }, { name: 'Freecharge', icon: '🟣' }].map(w => (
                  <button key={w.name} onClick={handleOnlinePayment}
                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1rem', border: '2px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', background: 'white', fontWeight: 700, fontSize: '0.88rem', color: '#374151' }}>
                    <span style={{ fontSize: '1.3rem' }}>{w.icon}</span>{w.name}<ChevronRight size={16} style={{ marginLeft: 'auto', color: '#94a3b8' }} />
                  </button>
                ))}
              </div>
            )}
            {payPhase === null && (
              <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Shield size={11} /> 256-bit SSL · PCI DSS Compliant
              </div>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10010, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <motion.div initial={{ y: 300, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 300, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }} onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 520, paddingBottom: '2.5rem' }}>
        <div style={{ padding: '1.75rem 1.75rem 0' }}>
          <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 1.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>Choose Payment Method</h3>
          <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>Total: <strong style={{ color: '#7C3AED', fontSize: '1.05rem' }}>₹{total.toLocaleString('en-IN')}</strong></p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0 1.75rem', marginBottom: '1.25rem' }}>
          {options.map(opt => (
            <div key={opt.id} onClick={() => setSelected(opt.id)}
              style={{ border: `2px solid ${selected === opt.id ? '#7C3AED' : '#e2e8f0'}`, borderRadius: 16, padding: '1rem 1.1rem', cursor: 'pointer', background: selected === opt.id ? '#f5f3ff' : 'white', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: selected === opt.id ? '#7C3AED18' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>{opt.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {opt.label}
                    <span style={{ background: opt.badgeColor + '18', color: opt.badgeColor, fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, border: `1px solid ${opt.badgeColor}30` }}>{opt.badge}</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 3 }}>{opt.sub}</div>
                  {selected === opt.id && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {opt.detail.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.73rem', color: '#059669', fontWeight: 600 }}>
                          <CheckCircle2 size={12} /> {d}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${selected === opt.id ? '#7C3AED' : '#cbd5e1'}`, background: selected === opt.id ? '#7C3AED' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  {selected === opt.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 1.75rem' }}>
          <button onClick={handleConfirm} disabled={confirming}
            style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg,#7C3AED,#a855f7)', color: 'white', fontWeight: 800, fontSize: '1rem', border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
            {confirming ? <><RefreshCw size={16} className="spin-icon" /> Processing…</> :
              selected === 'online' ? <><CreditCard size={16} /> Continue to Pay ₹{total.toLocaleString('en-IN')}</> :
                <><CheckCheck size={16} /> Confirm Booking</>}
          </button>
          <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Shield size={11} /> 256-bit SSL encrypted · Your info is safe
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

  const MOCK_TECH = {
    name: "Ravi Kumar",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: 4.9,
    jobs: 284,
    eta: "25 mins",
  }

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

          {phase === 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ marginTop: '1.5rem', background: '#f8fafc', borderRadius: 14, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <img src={MOCK_TECH.avatar} alt={MOCK_TECH.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #7C3AED30' }} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{MOCK_TECH.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>⭐ {MOCK_TECH.rating} · {MOCK_TECH.jobs} jobs</div>
              </div>
              <div style={{ background: '#10B98115', color: '#10B981', fontWeight: 800, fontSize: '0.7rem', padding: '4px 10px', borderRadius: 99, border: '1px solid #10B98130' }}>ETA {MOCK_TECH.eta}</div>
            </motion.div>
          )}

          {phase === 3 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              onClick={() => onDone(MOCK_TECH)}
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
  const totalPrice = cart ? cart.reduce((a, c) => a + (c.price * c.quantity), 0) : 0
  const displayDate = selDate ? new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : ""
  const displayTime = selTime ? TIME_SLOTS.flatMap(g => g.slots).find(s => s.t === selTime)?.l : ""

  const trackSteps = [
    { label: "Booking Confirmed", icon: "✅", done: true, time: "Just now" },
    { label: "Expert Assigned", icon: "👨‍🔧", done: false, time: "Pending" },
    { label: "Expert On The Way", icon: "🛵", done: false, time: "Pending" },
    { label: "Service In Progress", icon: "⚙️", done: false, time: "Scheduled" },
    { label: "Service Completed", icon: "🌟", done: false, time: "Pending" },
  ]

  useEffect(() => {
    if (etaMinutes <= 0) return
    const t = setInterval(() => setEtaMinutes(m => m > 0 ? m - 1 : 0), 60000)
    return () => clearInterval(t)
  }, [etaMinutes])

  const tech = technician || { name: "Ravi Kumar", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face", rating: 4.9, jobs: 284, eta: "25 mins" }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}
        >
          <CheckCircle2 size={44} color="white" />
        </motion.div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>Booking Confirmed! 🎉</h2>
        <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontSize: '0.9rem' }}>Your expert is on the way</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f5f3ff', border: '1px solid #7C3AED30', borderRadius: 99, padding: '6px 16px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>Booking Ref</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>#{rid}</span>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <img src={tech.avatar} alt={tech.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7C3AED30' }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: '#10B981', border: '2px solid white' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '1.05rem' }}>{tech.name}</div>
            <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>⭐ {tech.rating} · {tech.jobs} jobs completed</div>
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
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}
      >
        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.75rem' }}>📋 Booking Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.8rem' }}>
          {[
            { label: 'Service', value: category?.name },
            { label: 'Date', value: displayDate },
            { label: 'Time', value: displayTime },
            { label: 'Address', value: formData?.address, span: true },
            { label: 'Total Amount', value: `₹${totalPrice}`, highlight: true },
          ].map((r, i) => (
            <div key={i} style={{ ...(r.span ? { gridColumn: '1/-1' } : {}), background: '#f8fafc', borderRadius: 10, padding: '0.5rem 0.75rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>{r.label}</div>
              <div style={{ fontWeight: 700, color: r.highlight ? '#7C3AED' : '#0f172a', marginTop: 2 }}>{r.value || '—'}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}
      >
        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.75rem' }}>🗺️ Live Tracking</div>
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
  const { user, refreshMe } = useAuth()

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
    } catch (e) {
      setLoginError(e.body?.detail || 'Invalid OTP')
    }
    setLoginLoading(false)
  }

  const handleLogout = async () => {
    await apiLogout()
    await refreshMe()
  }

  const handleGoogleLogin = () => {
    openGoogleSignInPopup(
      async (accessToken) => {
        setLoginLoading(true);
        setLoginError("");
        try {
          const res = await apiRequest("/auth/customer/google/", {
            method: "POST",
            json: { access_token: accessToken }
          });
          if (res.success) {
            await refreshMe();
          } else {
            setLoginError(res.detail || "Google login failed");
          }
        } catch (err) {
          setLoginError(err?.body?.detail || "Google login failed");
        } finally {
          setLoginLoading(false);
        }
      },
      (err) => setLoginError(err)
    );
  };

  const [selectedMockBooking, setSelectedMockBooking] = useState(null)

  const [realBookings, setRealBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(false)

  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')

  useEffect(() => {
    if (user) {
      const uFullName = user?.firstName ? `${user.firstName} ${user?.lastName || ''}`.trim() : ''
      setProfileName(uFullName)
      setProfilePhone(user?.phone || '')
      setProfileEmail(user?.email || '')
    }
  }, [user])

  const handleSaveProfile = async () => {
    setProfileError('')
    setProfileSuccess('')
    setIsSavingProfile(true)
    const nameParts = profileName.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ')

    try {
      const res = await apiRequest("/auth/profile/", {
        method: "PATCH",
        json: {
          first_name: firstName,
          last_name: lastName,
          phone: profilePhone,
          email: profileEmail
        }
      })
      if (res.success || res.id) {
        await refreshMe()
        setProfileSuccess("Changes saved successfully!")
      } else {
        setProfileError(res.message || "Failed to update profile")
      }
    } catch (e) {
      setProfileError(e.body?.message || "Failed to update profile")
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
    { id: "Payment Methods", icon: CreditCard },
    { id: "Notifications", icon: Bell },
    { id: "Help & Support", icon: LifeBuoy },
  ]

  const mockBookings = [
    { id: "BK482910", service: "AC Servicing", date: "Aug 15, 2026", status: "Completed", amount: "₹899" },
    { id: "BK483122", service: "Deep Cleaning", date: "Sep 02, 2026", status: "Upcoming", amount: "₹2,499" },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case "My Profile":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>My Profile</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0' }}>
                <User size={36} color="#94a3b8" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginBottom: 4 }}>{userFullName}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 12 }}>{userEmail || userPhone}</div>
                <button style={{ padding: '0.5rem 1.25rem', background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Change Photo</button>
              </div>
            </div>

            {profileError && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, marginBottom: 16 }}>{profileError}</div>}
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
              {bookingsLoading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading bookings...</div> : realBookings.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No bookings found.</div> : realBookings.map(b => (
                <React.Fragment key={b.id}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', position: 'relative', zIndex: 1 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>{b.service_category_display || b.issue_title || 'Service Booking'}</span>
                        <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 99, fontWeight: 800, background: b.status === 'completed' ? '#10B98115' : '#7C3AED15', color: b.status === 'completed' ? '#10B981' : '#7C3AED', border: `1px solid ${b.status === 'completed' ? '#10B98130' : '#7C3AED30'}` }}>{b.status_display || b.status}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} /> {b.preferred_date || 'N/A'} &nbsp;•&nbsp; <span style={{ fontFamily: 'monospace' }}>{b.request_id}</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 12, fontSize: '1.1rem' }}>Paid</div>
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
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '1.25rem', marginTop: '-16px', position: 'relative', zIndex: 0 }}>
                      <div style={{ fontWeight: 800, color: '#334155', marginBottom: 12 }}>Booking Overview</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: 4 }}>Assigned Expert</div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.assigned_employee ? b.assigned_employee.full_name : 'Not assigned yet'}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: 4 }}>Payment Status</div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.payment_status_display || (b.payment_status === 'paid' ? 'Paid' : 'Pending')}</div>
                        </div>
                        <div style={{ gridColumn: '1/-1', borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 4 }}>
                          <div style={{ color: '#64748b', marginBottom: 4 }}>Service Address</div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.address || 'N/A'}</div>
                        </div>

                        {(b.payment_status === 'paid' || b.payment_status === 'collected') && (
                          <div style={{ gridColumn: '1/-1', borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 4, display: 'flex', gap: 10 }}>
                            <button onClick={() => window.open(`http://localhost:8000/api/booking/${b.id}/invoice/`, '_blank')} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><FileText size={14} /> Download Invoice</button>
                            <button onClick={() => alert("Invoice successfully sent to your registered email!")} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Mail size={14} /> Email Invoice</button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        )
      case "Saved Addresses":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Saved Addresses</h3>

            {isAddingAddress ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.5rem', background: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 16, color: '#0f172a' }}>{editingAddressId ? 'Edit Address' : 'Add New Address'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: 8 }}>Address Title (e.g., Home, Work)</label>
                    <input value={newAddressTitle} onChange={e => setNewAddressTitle(e.target.value)} type="text" placeholder="Work" style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: 8 }}>Full Address</label>
                    <textarea value={newAddressText} onChange={e => setNewAddressText(e.target.value)} rows={3} placeholder="123 Main St..." style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', resize: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button onClick={handleAddAddress} style={{ fontSize: '0.85rem', padding: '10px 20px', borderRadius: 8, border: 'none', background: '#7C3AED', color: 'white', fontWeight: 800, cursor: 'pointer' }}>{editingAddressId ? 'Save Changes' : 'Save Address'}</button>
                    <button onClick={() => { setIsAddingAddress(false); setEditingAddressId(null); setNewAddressTitle(''); setNewAddressText(''); }} style={{ fontSize: '0.85rem', padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {mockAddresses.map(address => (
                  <div key={address.id} style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.5rem', position: 'relative', background: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ position: 'absolute', top: 20, right: 20, color: '#94a3b8', cursor: 'pointer' }}><MapPin size={20} /></div>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 8, fontSize: '1.05rem' }}>{address.title}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{address.address}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                      <button onClick={() => handleEditClick(address)} style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleRemoveAddress(address.id)} style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: 6, border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                ))}
                <div onClick={() => setIsAddingAddress(true)} style={{ border: '2px dashed #cbd5e1', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', color: '#7C3AED', background: '#f8fafc', transition: 'all 0.2s', minHeight: 180 }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#7C3AED15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={20} /></div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Add New Address</div>
                </div>
              </div>
            )}
          </motion.div>
        )
      case "Payment Methods":
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Payment Methods</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 16, background: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ width: 56, height: 36, background: '#1e293b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 900, fontStyle: 'italic' }}>VISA</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>•••• •••• •••• 4242</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>Expires 12/28</div>
                </div>
                <button style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: 8, border: '1px solid #fee2e2', color: '#ef4444', background: '#fef2f2', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
              </div>
              <button style={{ padding: '1.25rem', border: '2px dashed #cbd5e1', borderRadius: 16, background: '#f8fafc', color: '#7C3AED', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>+ Add New Card / UPI</button>
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
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 6, lineHeight: 1.5 }}>You successfully saved ₹100 on your last Deep Cleaning booking!</div>
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
      default:
        return null
    }
  }

  if (!user || user.role !== 'customer') {
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
                onClick={handleGoogleLogin}
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
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color="#64748b" />
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
        if (catRes.success) {
          const cats = catRes.data.map((c, i) => ({
            id: c.id.toString(),
            name: c.name,
            desc: c.description || "Expert " + c.name + " service",
            rating: c.rating || "4.8",
            jobs: c.jobs_count_str || "10K+",
            image: c.image || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&q=80&fit=crop"
          }))
          setCategoriesData(cats)
        }
        if (svcRes.success) {
          const pkgs = {}
          svcRes.data.forEach(s => {
            const cid = s.category.toString()
            if (!pkgs[cid]) pkgs[cid] = []
            pkgs[cid].push({
              id: s.id.toString(),
              name: s.name,
              price: parseFloat(s.price),
              priceStr: "₹" + s.price,
              duration: s.duration || "1 hr",
              payment_policy: s.payment_policy,
              image: s.image || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&q=80&fit=crop",
              includes: Array.isArray(s.includes) && s.includes.length > 0 ? s.includes : ["Standard inclusions"],
              excludes: Array.isArray(s.excludes) ? s.excludes : [],
              popular: !!s.popular,
              tag: s.tag || ""
            })
          })
          setPackagesData(pkgs)
        }
      } catch (e) {
        console.error("Failed to load catalog", e)
      }
    }
    loadCatalog()

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
                        <div style={{ fontWeight: 800, color: '#1e293b' }}>₹{c.price * c.quantity}</div>
                      </div>
                    ))}

                    <div style={{ height: 1, background: '#e2e8f0', margin: '0.5rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', margin: '0.8rem 0' }}>
                      <span>Total Items : {cart.reduce((a, c) => a + c.quantity, 0)}</span>
                      <span>Total Price : ₹{cart.reduce((a, c) => a + (c.price * c.quantity), 0)}</span>
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
          }}>
            <User size={20} color="#1e293b" />
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
                  pkg={cart[0] || { name: "Multiple Items", priceStr: "₹" + cart.reduce((a, c) => a + (c.price * c.quantity), 0) }}
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
  const packages = (packagesData && packagesData[category?.id]) || PACKAGES[category?.id] || []
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
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>{s.priceStr || '₹499'} • {s.duration || '1 hr'}</div>

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
              <span className="uc-cart-bar-price">₹{cart.reduce((a, c) => a + (c.price * c.quantity), 0)}</span>
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
        display:flex; gap:0.5rem; overflow-x:auto;
        scrollbar-width:none; padding-bottom:0.25rem;
      }
      .uc-date-scroll::-webkit-scrollbar { display:none; }
      .uc-date-pill {
        display:flex; flex-direction:column; align-items:center;
        min-width:62px; padding:0.6rem 0.5rem;
        border:2px solid #e2e8f0; border-radius:14px;
        background:white; cursor:pointer;
        font-family:inherit; position:relative;
        transition:all 0.15s ease;
        gap:0.15rem;
      }
      .uc-date-pill:hover { border-color:#7C3AED; }
      .uc-date-pill--sel { border-color:#7C3AED; background:#7C3AED; }
      .uc-date-today-tag {
        position:absolute; top:-9px; left:50%; transform:translateX(-50%);
        background:#10B981; color:white; font-size:0.55rem;
        font-weight:800; padding:1px 6px; border-radius:99px; white-space:nowrap;
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
