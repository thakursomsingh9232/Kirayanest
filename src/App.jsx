import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  Home, Search, MapPin, Phone, Plus, LogOut, User, SlidersHorizontal,
  IndianRupee, DoorOpen, Trash2, Loader2, KeyRound, Upload, Sparkles,
  ShieldCheck, Truck, HeartHandshake, Mail,
} from "lucide-react";

const ROOM_TYPES = ["Single Room", "Shared Room", "1 RK", "1 BHK", "PG"];
const ROOM_TYPE_EMOJI = {
  "Single Room": "🛏️",
  "Shared Room": "🏘️",
  "1 RK": "🏠",
  "1 BHK": "🏡",
  PG: "🎓",
};

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.5 29.5 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.5 29.5 3.5 24 3.5c-7.6 0-14.1 4.3-17.7 10.6.1.2.1.4 0 .6z" />
      <path fill="#4CAF50" d="M24 44.5c5.3 0 10.2-2 13.9-5.3l-6.4-5.4c-2 1.5-4.6 2.4-7.5 2.4-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.9 39.9 16.4 44.5 24 44.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.4 5.4C41.3 36 44.5 30.5 44.5 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-ink/10 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState("browse");
  const [authMode, setAuthMode] = useState("login");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [myRooms, setMyRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const [fLocation, setFLocation] = useState("");
  const [fType, setFType] = useState("All");
  const [fMaxRent, setFMaxRent] = useState("");

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRooms(data);
    setLoadingRooms(false);
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  useEffect(() => {
    if (session) {
      setMyRooms(rooms.filter((r) => r.owner_id === session.user.id));
    }
  }, [rooms, session]);

  async function handleGoogleLogin() {
    setError("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function handleAuth(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.target);
    const email = (form.get("email") || "").trim();
    const password = form.get("password") || "";
    const name = (form.get("name") || "").trim();
    const phone = (form.get("phone") || "").trim();

    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, phone } },
      });
      if (error) setError(error.message);
      else setNotice("Account ban gaya! Agar email confirmation on hai, apna inbox check karein.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else setView("browse");
    }
    setBusy(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setView("browse");
  }

  function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  async function handleAddRoom(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.target);
    const title = (form.get("title") || "").trim();
    const rent = Number(form.get("rent"));
    const location = (form.get("location") || "").trim();
    const roomType = form.get("roomType");
    const contact = (form.get("contact") || "").trim();

    if (!title || !rent || !location || !contact) {
      setError("Title, rent, location aur contact zaroori hain.");
      setBusy(false);
      return;
    }

    let photoUrl = "";
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("room-photos")
        .upload(path, photoFile);
      if (uploadError) {
        setError("Photo upload nahi ho paayi: " + uploadError.message);
        setBusy(false);
        return;
      }
      const { data } = supabase.storage.from("room-photos").getPublicUrl(path);
      photoUrl = data.publicUrl;
    }

    const { error: insertError } = await supabase.from("rooms").insert({
      owner_id: session.user.id,
      owner_name: session.user.user_metadata?.full_name || "Owner",
      title, rent, location, room_type: roomType, contact, photo_url: photoUrl,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setNotice("Room list ho gaya!");
      setTimeout(() => setNotice(""), 2500);
      e.target.reset();
      setPhotoFile(null);
      setPhotoPreview("");
      await loadRooms();
      setView("mine");
    }
    setBusy(false);
  }

  async function handleDeleteRoom(id) {
    await supabase.from("rooms").delete().eq("id", id);
    await loadRooms();
  }

  const filteredRooms = rooms.filter((r) => {
    if (fLocation && !r.location.toLowerCase().includes(fLocation.toLowerCase())) return false;
    if (fType !== "All" && r.room_type !== fType) return false;
    if (fMaxRent && r.rent > Number(fMaxRent)) return false;
    return true;
  });

  function jumpToBrowseWithType(type) {
    setFType(type);
    setView("browse");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-brand" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <header className="border-b border-ink/10 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setView("browse")} className="font-display font-extrabold text-2xl tracking-tight text-brand">
            Kiraya Nest
          </button>
          <nav className="flex items-center gap-1 text-sm">
            <button onClick={() => setView("browse")} className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${view === "browse" ? "bg-brand text-white" : "hover:bg-brandlight text-ink"}`}>
              <Search size={15} /> <span className="hidden sm:inline">Browse</span>
            </button>
            {session ? (
              <>
                <button onClick={() => setView("add")} className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${view === "add" ? "bg-brand text-white" : "hover:bg-brandlight text-ink"}`}>
                  <Plus size={15} /> <span className="hidden sm:inline">List a room</span>
                </button>
                <button onClick={() => setView("mine")} className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${view === "mine" ? "bg-brand text-white" : "hover:bg-brandlight text-ink"}`}>
                  <User size={15} /> <span className="hidden sm:inline">My listings</span>
                </button>
                <button onClick={handleLogout} className="px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-brandlight" title="Logout">
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <button onClick={() => { setView("auth"); setAuthMode("login"); setShowEmailForm(false); setError(""); }} className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 font-medium ${view === "auth" ? "bg-brand text-white" : "border border-brand text-brand"}`}>
                <KeyRound size={15} /> Login
              </button>
            )}
          </nav>
        </div>
      </header>

      {notice && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="px-4 py-2 rounded-xl bg-brand text-white text-sm">{notice}</div>
        </div>
      )}

      {view === "browse" && (
        <>
          <section className="bg-gradient-to-b from-brandlight to-paper px-4 pt-10 pb-14 text-center">
            <span className="inline-flex items-center gap-1.5 bg-white text-brand text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm">
              <Sparkles size={13} /> Affordable Rooms, Har Shehar Mein
            </span>
            <h1 className="font-display text-4xl font-extrabold mt-4 text-ink">Kiraya Nest</h1>
            <p className="text-brand italic font-medium mt-2">Naye shehar mein, apna thikana.</p>
            <p className="text-ink/60 text-sm max-w-md mx-auto mt-3">
              Single rooms, shared rooms, 1BHK aur PG — seedha owners se, bina broker ke, sabse affordable rate par.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <button onClick={() => document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" })} className="px-6 py-2.5 rounded-full bg-brand text-white font-semibold shadow-md">
                Rooms Dekhein
              </button>
              <button onClick={() => (session ? setView("add") : setView("auth"))} className="px-6 py-2.5 rounded-full bg-white border-2 border-brand text-brand font-semibold">
                Apna Room List Karein
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mt-8 text-sm text-ink/70">
              <span className="flex items-center gap-2 justify-center"><ShieldCheck size={16} className="text-brand" /> Verified Owners</span>
              <span className="flex items-center gap-2 justify-center"><Truck size={16} className="text-brand" /> Pan India</span>
              <span className="flex items-center gap-2 justify-center"><IndianRupee size={16} className="text-brand" /> Zero Brokerage</span>
              <span className="flex items-center gap-2 justify-center"><HeartHandshake size={16} className="text-brand" /> Owner se Seedha Baat</span>
            </div>
          </section>

          <section className="max-w-5xl mx-auto px-4 py-10">
            <p className="text-brand text-xs font-bold tracking-wide text-center">EXPLORE ROOMS</p>
            <h2 className="font-display text-2xl font-bold text-center mt-1">Room Type Se Dhoondein</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
              {ROOM_TYPES.map((t) => (
                <button key={t} onClick={() => jumpToBrowseWithType(t)} className="bg-white border border-brand/20 rounded-2xl p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition">
                  <div className="text-3xl">{ROOM_TYPE_EMOJI[t]}</div>
                  <p className="font-semibold text-sm mt-2">{t}</p>
                  <p className="text-xs text-brand mt-0.5">Dekhein →</p>
                </button>
              ))}
            </div>
          </section>

          <section id="listings" className="max-w-5xl mx-auto px-4 pb-16">
            <Card className="p-4 mb-6 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><MapPin size={12} /> Location</label>
                <input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="e.g. Koramangala" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="min-w-[140px]">
                <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><SlidersHorizontal size={12} /> Room type</label>
                <select value={fType} onChange={(e) => setFType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                  <option>All</option>
                  {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><IndianRupee size={12} /> Max rent</label>
                <input type="number" value={fMaxRent} onChange={(e) => setFMaxRent(e.target.value)} placeholder="e.g. 8000" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </Card>

            {loadingRooms ? (
              <div className="text-center py-16"><Loader2 className="animate-spin mx-auto text-brand" /></div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-16 text-ink/50">
                <Home size={32} className="mx-auto mb-2" />
                <p>Koi room nahi mila. Filters badal kar dekhein, ya khud pehla listing dalein.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredRooms.map((r) => (
                  <Card key={r.id} className="overflow-hidden flex flex-col">
                    <div className="h-36 bg-brandlight flex items-center justify-center overflow-hidden">
                      {r.photo_url ? (
                        <img src={r.photo_url} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <Home size={28} className="text-brand/40" />
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold font-display">{r.title}</h3>
                        <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-gold/15 text-[#8a5b12] flex items-center gap-0.5">
                          <IndianRupee size={11} />{Number(r.rent).toLocaleString("en-IN")}/mo
                        </span>
                      </div>
                      <p className="text-sm text-ink/60 flex items-center gap-1 mt-1"><MapPin size={13} /> {r.location}</p>
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-brandlight text-brand font-medium w-fit">{ROOM_TYPE_EMOJI[r.room_type]} {r.room_type}</span>
                      <div className="mt-3 pt-3 border-t border-ink/10 text-sm flex items-center justify-between">
                        <span className="text-ink/50">by {r.owner_name}</span>
                        <span className="flex items-center gap-1 font-medium text-brand"><Phone size={13} /> {r.contact}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="bg-brandlight py-12 px-4 text-center">
            <h2 className="font-display text-2xl font-bold">Kyun Chunein Kiraya Nest?</h2>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-6 text-sm">
              <span>✨ Verified Listings</span>
              <span>🚚 Fast Response</span>
              <span>🏠 Bina Brokerage</span>
              <span>💝 100% Free to Browse</span>
            </div>
          </section>

          <footer className="bg-navy text-white/80 px-4 py-8 text-center text-sm">
            <p className="font-display text-xl font-bold text-brand mb-1">Kiraya Nest</p>
            <p>Naye shehar mein, apna thikana — affordable rooms, seedha owners se.</p>
          </footer>
        </>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        {view === "auth" && (
          <div className="max-w-sm mx-auto">
            <Card className="p-6">
              {!showEmailForm ? (
                <>
                  <h2 className="font-display text-xl font-bold text-center mb-1">Create account</h2>
                  <p className="text-xs text-ink/50 text-center mb-5">Ya agar account already hai, seedha login karein</p>
                  <div className="space-y-3">
                    <button onClick={handleGoogleLogin} className="w-full py-2.5 rounded-full border border-ink/15 flex items-center justify-center gap-2 font-medium text-sm hover:bg-ink/5">
                      <GoogleIcon /> Continue with Google
                    </button>
                    <button onClick={() => setShowEmailForm(true)} className="w-full py-2.5 rounded-full border border-ink/15 flex items-center justify-center gap-2 font-medium text-sm hover:bg-ink/5">
                      <Mail size={18} /> Continue with Email
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => setShowEmailForm(false)} className="text-xs text-brand mb-3">← Wapas</button>
                  <div className="flex gap-2 mb-5 text-sm">
                    <button onClick={() => { setAuthMode("login"); setError(""); }} className={`flex-1 py-1.5 rounded-full ${authMode === "login" ? "bg-brand text-white" : "bg-brandlight text-brand"}`}>Login</button>
                    <button onClick={() => { setAuthMode("signup"); setError(""); }} className={`flex-1 py-1.5 rounded-full ${authMode === "signup" ? "bg-brand text-white" : "bg-brandlight text-brand"}`}>Sign up</button>
                  </div>
                  <form onSubmit={handleAuth} className="space-y-3">
                    {authMode === "signup" && (
                      <>
                        <input name="name" placeholder="Poora naam" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required />
                        <input name="phone" placeholder="Phone number" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required />
                      </>
                    )}
                    <input name="email" type="email" placeholder="Email" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required />
                    <input name="password" type="password" placeholder="Password (kam se kam 6 characters)" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required minLength={6} />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button disabled={busy} type="submit" className="w-full py-2 rounded-full bg-brand text-white font-semibold text-sm disabled:opacity-60">
                      {busy ? "Ruk jaayein..." : authMode === "login" ? "Login" : "Account banayein"}
                    </button>
                  </form>
                </>
              )}
            </Card>
          </div>
        )}

        {view === "add" && session && (
          <div className="max-w-lg mx-auto">
            <h2 className="font-display text-2xl font-bold mb-4">Room list karein</h2>
            <Card className="p-6">
              <form onSubmit={handleAddRoom} className="space-y-3">
                <input name="title" placeholder="Title (e.g. Sunny single room near metro)" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required />
                <div className="grid grid-cols-2 gap-3">
                  <input name="rent" type="number" placeholder="Rent (₹/month)" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required />
                  <select name="roomType" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm">
                    {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <input name="location" placeholder="Location / area, city" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required />
                <input name="contact" placeholder="Contact number" className="w-full px-3 py-2 rounded-lg border border-ink/15 text-sm" required />

                <div>
                  <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><Upload size={12} /> Room ki photo</label>
                  <input type="file" accept="image/*" onChange={onPhotoChange} className="w-full text-sm" />
                  {photoPreview && <img src={photoPreview} alt="preview" className="mt-2 h-32 rounded-lg object-cover" />}
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                <button disabled={busy} type="submit" className="w-full py-2 rounded-full bg-brand text-white font-semibold text-sm disabled:opacity-60">
                  {busy ? "Upload ho raha hai..." : "Room daalein"}
                </button>
              </form>
            </Card>
          </div>
        )}

        {view === "mine" && session && (
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Mere listings</h2>
            {myRooms.length === 0 ? (
              <p className="text-ink/50">Abhi tak koi listing nahi. <button onClick={() => setView("add")} className="text-brand font-medium underline">Pehla room daalein</button>.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {myRooms.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold font-display">{r.title}</h3>
                      <button onClick={() => handleDeleteRoom(r.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                    </div>
                    <p className="text-sm text-ink/60 flex items-center gap-1 mt-1"><MapPin size={13} /> {r.location}</p>
                    <p className="text-sm mt-1 flex items-center gap-1"><IndianRupee size={13} />{Number(r.rent).toLocaleString("en-IN")}/mo · {r.room_type}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {(view === "add" || view === "mine") && !session && (
          <div className="text-center py-16">
            <p className="text-ink/60 mb-3">Yeh feature use karne ke liye login karein.</p>
            <button onClick={() => setView("auth")} className="px-4 py-2 rounded-full bg-brand text-white text-sm font-semibold">Login / Sign up</button>
          </div>
        )}
      </main>
    </div>
  );
            }
