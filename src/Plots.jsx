import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin, Phone, Plus, User, SlidersHorizontal, IndianRupee, Trash2,
  Loader2, Upload, ShieldCheck, ShieldAlert, FileCheck2, Video, Camera,
  Flag, X, LocateFixed, BadgeCheck, LandPlot,
} from "lucide-react";

// Fix default marker icon (Leaflet + bundlers issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SIZE_UNITS = ["sq.ft", "sq.yd (gaj)", "acre", "bigha", "hectare"];
const DEFAULT_CENTER = [22.9734, 78.6569]; // India center

function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-ink/10 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-ink/5 text-ink/60",
    good: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-800",
    brand: "bg-brandlight text-brand",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}

function LocationPicker({ lat, lng, onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return lat && lng ? <Marker position={[lat, lng]} /> : null;
}

export default function Plots({ session }) {
  const [view, setView] = useState("browse"); // browse | add | mine | detail
  const [plots, setPlots] = useState([]);
  const [myPlots, setMyPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePlot, setActivePlot] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [myReportedIds, setMyReportedIds] = useState([]);

  // filters
  const [fLocation, setFLocation] = useState("");
  const [fMaxPrice, setFMaxPrice] = useState("");

  // add-plot form state
  const [pinLat, setPinLat] = useState(null);
  const [pinLng, setPinLng] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoGeo, setPhotoGeo] = useState({ lat: null, lng: null });
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [distanceWarning, setDistanceWarning] = useState("");

  // phone OTP verification state
  const [phone, setPhone] = useState("");
  const [phoneStage, setPhoneStage] = useState("idle"); // idle | sent | verified | unavailable
  const [otp, setOtp] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");

  const formRef = useRef(null);

  const loadPlots = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("plots")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setPlots(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadPlots(); }, [loadPlots]);

  useEffect(() => {
    if (session) setMyPlots(plots.filter((p) => p.owner_id === session.user.id));
  }, [plots, session]);

  useEffect(() => {
    if (!session) return;
    supabase.from("plot_reports").select("plot_id").eq("reporter_id", session.user.id)
      .then(({ data }) => { if (data) setMyReportedIds(data.map((r) => r.plot_id)); });
  }, [session, view]);

  function resetForm() {
    setPinLat(null); setPinLng(null);
    setPhotoFile(null); setPhotoPreview(""); setPhotoGeo({ lat: null, lng: null });
    setVideoFile(null); setVideoPreview("");
    setDocFile(null);
    setDistanceWarning("");
    setPhone(""); setPhoneStage("idle"); setOtp(""); setPhoneMsg("");
    if (formRef.current) formRef.current.reset();
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPinLat(pos.coords.latitude); setPinLng(pos.coords.longitude); },
      () => setError("Location nahi mil paayi. Map par click karke pin lagayein.")
    );
  }

  function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    // Capture live GPS at the moment the photo is taken — used to cross-check against the pin
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setPhotoGeo({ lat, lng });
        if (pinLat && pinLng) {
          const d = haversineKm(pinLat, pinLng, lat, lng);
          if (d !== null && d > 2) {
            setDistanceWarning(`⚠️ Photo lene ki jagah aur map pin mein ${d.toFixed(1)} km ka fark hai. Check kar lein sahi location di hai ya nahi.`);
          } else {
            setDistanceWarning("");
          }
        }
      });
    }
  }

  function onVideoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  async function sendOtp() {
    setPhoneMsg(""); setError("");
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) { setPhoneMsg("Sahi 10-digit number daalein."); return; }
    const fullPhone = cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`;
    setPhoneBusy(true);
    const { error } = await supabase.auth.updateUser({ phone: fullPhone });
    setPhoneBusy(false);
    if (error) {
      // Phone OTP provider (Twilio/MSG91 etc.) likely not configured on Supabase yet
      setPhoneStage("unavailable");
      setPhoneMsg("Abhi OTP verification available nahi hai. Number bina verify ke bhi daal sakte hain — listing 'Unverified' dikhegi.");
    } else {
      setPhoneStage("sent");
      setPhoneMsg("OTP bhej diya gaya hai, neeche daalein.");
    }
  }

  async function verifyOtp() {
    setPhoneMsg(""); setError("");
    const cleaned = phone.replace(/\D/g, "");
    const fullPhone = cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`;
    setPhoneBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: "phone_change" });
    setPhoneBusy(false);
    if (error) {
      setPhoneMsg("OTP galat hai ya expire ho gaya. Dubara try karein.");
    } else {
      setPhoneStage("verified");
      setPhoneMsg("✅ Number verify ho gaya!");
    }
  }

  async function handleAddPlot(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    const form = new FormData(e.target);
    const title = (form.get("title") || "").trim();
    const description = (form.get("description") || "").trim();
    const price = Number(form.get("price"));
    const sizeValue = Number(form.get("sizeValue"));
    const sizeUnit = form.get("sizeUnit");
    const locationText = (form.get("locationText") || "").trim();
    const contact = phone.replace(/\D/g, "") || (form.get("contact") || "").trim();

    if (!title || !price || !sizeValue || !locationText || !contact) {
      setError("Title, price, size, location aur contact number zaroori hain.");
      setBusy(false);
      return;
    }
    if (!pinLat || !pinLng) {
      setError("Kripya map par plot ki exact location pin karein.");
      setBusy(false);
      return;
    }
    if (!photoFile) {
      setError("Plot ki live photo lena zaroori hai.");
      setBusy(false);
      return;
    }

    let photoUrl = "", videoUrl = "", documentUrl = "";
    try {
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("plot-photos").upload(path, photoFile);
        if (upErr) throw new Error("Photo upload fail: " + upErr.message);
        photoUrl = supabase.storage.from("plot-photos").getPublicUrl(path).data.publicUrl;
      }
      if (videoFile) {
        const ext = videoFile.name.split(".").pop() || "mp4";
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("plot-videos").upload(path, videoFile);
        if (upErr) throw new Error("Video upload fail: " + upErr.message);
        videoUrl = supabase.storage.from("plot-videos").getPublicUrl(path).data.publicUrl;
      }
      if (docFile) {
        const ext = docFile.name.split(".").pop() || "jpg";
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("plot-documents").upload(path, docFile);
        if (upErr) throw new Error("Document upload fail: " + upErr.message);
        documentUrl = path; // private bucket — store path, not public URL
      }

      const { error: insertError } = await supabase.from("plots").insert({
        owner_id: session.user.id,
        owner_name: session.user.user_metadata?.full_name || "Seller",
        owner_phone: contact,
        phone_verified: phoneStage === "verified",
        title, description, price,
        size_value: sizeValue, size_unit: sizeUnit,
        location_text: locationText,
        lat: pinLat, lng: pinLng,
        photo_url: photoUrl,
        photo_captured_lat: photoGeo.lat, photo_captured_lng: photoGeo.lng,
        video_url: videoUrl,
        document_url: documentUrl,
        status: "unverified",
      });
      if (insertError) throw new Error(insertError.message);

      setNotice("Plot list ho gaya!");
      setTimeout(() => setNotice(""), 2500);
      resetForm();
      await loadPlots();
      setView("mine");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function handleDeletePlot(id) {
    await supabase.from("plots").delete().eq("id", id);
    await loadPlots();
  }

  async function reportPlot(plotId) {
    if (!session) { setError("Report karne ke liye login karein."); return; }
    const { error } = await supabase.from("plot_reports").insert({
      plot_id: plotId, reporter_id: session.user.id, reason: "user_reported_fraud",
    });
    if (!error) {
      setMyReportedIds((prev) => [...prev, plotId]);
      setNotice("Report darj ho gayi. Dhanyavaad, hum review karenge.");
      setTimeout(() => setNotice(""), 2500);
    }
  }

  const filteredPlots = plots.filter((p) => {
    if (fLocation && !p.location_text.toLowerCase().includes(fLocation.toLowerCase())) return false;
    if (fMaxPrice && p.price > Number(fMaxPrice)) return false;
    return true;
  });

  function TrustBadges({ p }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {p.status === "verified" ? (
          <Badge tone="good"><BadgeCheck size={12} /> KirayaNest Verified</Badge>
        ) : (
          <Badge tone="warn"><ShieldAlert size={12} /> Unverified</Badge>
        )}
        {p.phone_verified && <Badge tone="brand"><ShieldCheck size={12} /> Phone Verified</Badge>}
        {p.document_url && <Badge tone="neutral"><FileCheck2 size={12} /> Docs Submitted</Badge>}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {notice && <div className="mb-4 px-4 py-2 rounded-xl bg-brand text-white text-sm">{notice}</div>}
      {error && <div className="mb-4 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2"><LandPlot className="text-brand" /> Plots</h2>
          <p className="text-sm text-ink/60">Kisi bhi city ya village mein plot bechein ya khareedein.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setView("browse")} className={`px-3 py-1.5 rounded-full ${view === "browse" ? "bg-brand text-white" : "bg-brandlight text-brand"}`}>Browse</button>
          {session && (
            <>
              <button onClick={() => { resetForm(); setView("add"); }} className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${view === "add" ? "bg-brand text-white" : "bg-brandlight text-brand"}`}><Plus size={14} /> Plot Bechein</button>
              <button onClick={() => setView("mine")} className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${view === "mine" ? "bg-brand text-white" : "bg-brandlight text-brand"}`}><User size={14} /> Mere Plots</button>
            </>
          )}
        </div>
      </div>

      {/* BROWSE */}
      {view === "browse" && (
        <>
          <Card className="p-4 mb-6 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><MapPin size={12} /> City / Village</label>
              <input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="e.g. Indore" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" />
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><IndianRupee size={12} /> Max Price</label>
              <input type="number" value={fMaxPrice} onChange={(e) => setFMaxPrice(e.target.value)} placeholder="e.g. 500000" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" />
            </div>
          </Card>

          {loading ? (
            <div className="text-center py-16"><Loader2 className="animate-spin mx-auto text-brand" /></div>
          ) : filteredPlots.length === 0 ? (
            <div className="text-center py-16 text-ink/50">
              <LandPlot size={32} className="mx-auto mb-2" />
              <p>Koi plot nahi mila. Filters badlein ya khud pehla plot list karein.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredPlots.map((p) => (
                <Card key={p.id} className="overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition" onClick={() => { setActivePlot(p); setView("detail"); }}>
                  <div className="h-36 bg-brandlight flex items-center justify-center overflow-hidden">
                    {p.photo_url ? <img src={p.photo_url} alt={p.title} className="w-full h-full object-cover" /> : <LandPlot size={28} className="text-brand/40" />}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold font-display">{p.title}</h3>
                      <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-gold/15 text-[#8a5b12] flex items-center gap-0.5">
                        <IndianRupee size={11} />{Number(p.price).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-sm text-ink/60 flex items-center gap-1 mt-1"><MapPin size={13} /> {p.location_text}</p>
                    <p className="text-xs text-ink/50 mt-1">{p.size_value} {p.size_unit}</p>
                    <div className="mt-2"><TrustBadges p={p} /></div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* DETAIL */}
      {view === "detail" && activePlot && (
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView("browse")} className="text-sm text-brand mb-3 flex items-center gap-1"><X size={14} /> Band karein</button>
          <Card className="overflow-hidden">
            {activePlot.photo_url && <img src={activePlot.photo_url} alt={activePlot.title} className="w-full h-56 object-cover" />}
            <div className="p-5">
              <h3 className="font-display text-xl font-bold">{activePlot.title}</h3>
              <p className="text-brand font-bold text-lg mt-1 flex items-center gap-1"><IndianRupee size={16} />{Number(activePlot.price).toLocaleString("en-IN")}</p>
              <p className="text-sm text-ink/60 mt-1">{activePlot.size_value} {activePlot.size_unit}</p>
              <p className="text-sm text-ink/60 flex items-center gap-1 mt-1"><MapPin size={13} /> {activePlot.location_text}</p>
              {activePlot.description && <p className="text-sm mt-3">{activePlot.description}</p>}

              <div className="mt-3"><TrustBadges p={activePlot} /></div>

              {activePlot.lat && activePlot.lng && (
                <div className="mt-4 h-48 rounded-xl overflow-hidden border border-ink/10">
                  <MapContainer center={[activePlot.lat, activePlot.lng]} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                    <Marker position={[activePlot.lat, activePlot.lng]} />
                  </MapContainer>
                </div>
              )}

              {activePlot.video_url && (
                <video src={activePlot.video_url} controls className="w-full mt-4 rounded-xl" />
              )}

              <div className="mt-4 pt-4 border-t border-ink/10 flex items-center justify-between">
                <span className="text-sm text-ink/50">Seller: {activePlot.owner_name}</span>
                <a href={`tel:${activePlot.owner_phone}`} className="flex items-center gap-1 font-semibold text-brand"><Phone size={14} /> {activePlot.owner_phone}</a>
              </div>

              <button
                onClick={() => reportPlot(activePlot.id)}
                disabled={myReportedIds.includes(activePlot.id)}
                className="mt-4 w-full py-2 rounded-full border border-red-200 text-red-600 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Flag size={14} /> {myReportedIds.includes(activePlot.id) ? "Report Ho Chuki Hai" : "Fraud/Fake Listing Report Karein"}
              </button>
              <p className="text-xs text-ink/40 mt-2 text-center">KirayaNest sirf connect karwata hai. Payment ya deal se pehle documents khud verify karein.</p>
            </div>
          </Card>
        </div>
      )}

      {/* ADD PLOT */}
      {view === "add" && session && (
        <div className="max-w-lg mx-auto">
          <h3 className="font-display text-xl font-bold mb-1">Plot List Karein</h3>
          <p className="text-xs text-ink/50 mb-4">Fraud rokne ke liye live photo, GPS location aur (optional) document verification zaroori hai.</p>
          <Card className="p-6">
            <form ref={formRef} onSubmit={handleAddPlot} className="space-y-4">
              <input name="title" placeholder="Title (e.g. Corner plot near highway)" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required />
              <textarea name="description" placeholder="Details (road access, facing, nearby landmarks...)" rows={2} className="w-full px-3 py-2 rounded-lg bord
