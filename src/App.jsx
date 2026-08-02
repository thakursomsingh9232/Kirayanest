import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  Home, Search, MapPin, Phone, Plus, LogOut, User, SlidersHorizontal,
  IndianRupee, DoorOpen, Trash2, Loader2, KeyRound, Upload,
} from "lucide-react";

const ROOM_TYPES = ["Single Room", "Shared Room", "1 RK", "1 BHK", "PG"];

function Plate({ children, className = "" }) {
  return (
    <div className={`relative bg-white border border-ink/15 rounded-lg ${className}`}>
      <span className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-ink/20" />
      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-ink/20" />
      {children}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState("browse");
  const [authMode, setAuthMode] = useState("login");
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

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-teal" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <header className="border-b border-ink/10 bg-paper/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setView("browse")} className="flex items-center gap-2 font-display font-bold text-lg tracking-tight">
            <DoorOpen size={22} className="text-gold" />
            KiryaNest
          </button>
          <nav className="flex items-center gap-1 text-sm">
            <button onClick={() => setView("browse")} className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${view === "browse" ? "bg-teal text-paper" : "hover:bg-ink/5"}`}>
              <Search size={15} /> <span className="hidden sm:inline">Browse</span>
            </button>
            {session ? (
              <>
                <button onClick={() => setView("add")} className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${view === "add" ? "bg-teal text-paper" : "hover:bg-ink/5"}`}>
                  <Plus size={15} /> <span className="hidden sm:inline">List a room</span>
                </button>
                <button onClick={() => setView("mine")} className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${view === "mine" ? "bg-teal text-paper" : "hover:bg-ink/5"}`}>
                  <User size={15} /> <span className="hidden sm:inline">My listings</span>
                </button>
                <button onClick={handleLogout} className="px-3 py-1.5 rounded-md flex items-center gap-1.5 hover:bg-ink/5" title="Logout">
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <button onClick={() => { setView("auth"); setAuthMode("login"); setError(""); }} className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${view === "auth" ? "bg-teal text-paper" : "hover:bg-ink/5"}`}>
                <KeyRound size={15} /> Login
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {notice && <div className="mb-4 px-4 py-2 rounded-md bg-teal text-paper text-sm">{notice}</div>}

        {view === "browse" && (
          <div>
            <h1 className="font-display text-3xl font-bold mb-1">Naye shehar mein, apna thikana</h1>
            <p className="text-ink/60 mb-6 text-sm">Affordable rooms, seedha owners se — bina broker ke.</p>

            <Plate className="p-4 mb-6 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><MapPin size={12} /> Location</label>
                <input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="e.g. Koramangala" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
              </div>
              <div className="min-w-[140px]">
                <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><SlidersHorizontal size={12} /> Room type</label>
                <select value={fType} onChange={(e) => setFType(e.target.value)} className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm focus:outline-none focus:ring-2 focus:ring-teal">
                  <option>All</option>
                  {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><IndianRupee size={12} /> Max rent</label>
                <input type="number" value={fMaxRent} onChange={(e) => setFMaxRent(e.target.value)} placeholder="e.g. 8000" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
              </div>
            </Plate>

            {loadingRooms ? (
              <div className="text-center py-16"><Loader2 className="animate-spin mx-auto text-teal" /></div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-16 text-ink/50">
                <Home size={32} className="mx-auto mb-2" />
                <p>Koi room nahi mila. Filters badal kar dekhein, ya khud pehla listing dalein.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredRooms.map((r) => (
                  <Plate key={r.id} className="overflow-hidden flex flex-col">
                    <div className="h-36 bg-teal/10 flex items-center justify-center overflow-hidden">
                      {r.photo_url ? (
                        <img src={r.photo_url} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <Home size={28} className="text-teal/40" />
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold font-display">{r.title}</h3>
                        <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-gold/15 text-[#8a6a12] flex items-center gap-0.5">
                          <IndianRupee size={11} />{Number(r.rent).toLocaleString("en-IN")}/mo
                        </span>
                      </div>
                      <p className="text-sm text-ink/60 flex items-center gap-1 mt-1"><MapPin size={13} /> {r.location}</p>
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full border border-ink/15 w-fit">{r.room_type}</span>
                      <div className="mt-3 pt-3 border-t border-ink/10 text-sm flex items-center justify-between">
                        <span className="text-ink/50">by {r.owner_name}</span>
                        <span className="flex items-center gap-1 font-medium text-teal"><Phone size={13} /> {r.contact}</span>
                      </div>
                    </div>
                  </Plate>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "auth" && (
          <div className="max-w-sm mx-auto">
            <Plate className="p-6">
              <div className="flex gap-2 mb-5 text-sm">
                <button onClick={() => { setAuthMode("login"); setError(""); }} className={`flex-1 py-1.5 rounded-md ${authMode === "login" ? "bg-teal text-paper" : "bg-ink/5"}`}>Login</button>
                <button onClick={() => { setAuthMode("signup"); setError(""); }} className={`flex-1 py-1.5 rounded-md ${authMode === "signup" ? "bg-teal text-paper" : "bg-ink/5"}`}>Sign up</button>
              </div>
              <form onSubmit={handleAuth} className="space-y-3">
                {authMode === "signup" && (
                  <>
                    <input name="name" placeholder="Poora naam" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm" required />
                    <input name="phone" placeholder="Phone number" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm" required />
                  </>
                )}
                <input name="email" type="email" placeholder="Email" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm" required />
                <input name="password" type="password" placeholder="Password (kam se kam 6 characters)" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm" required minLength={6} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button disabled={busy} type="submit" className="w-full py-2 rounded-md bg-teal text-paper font-medium text-sm disabled:opacity-60">
                  {busy ? "Ruk jaayein..." : authMode === "login" ? "Login" : "Account banayein"}
                </button>
              </form>
            </Plate>
          </div>
        )}

        {view === "add" && session && (
          <div className="max-w-lg mx-auto">
            <h2 className="font-display text-2xl font-bold mb-4">Room list karein</h2>
            <Plate className="p-6">
              <form onSubmit={handleAddRoom} className="space-y-3">
                <input name="title" placeholder="Title (e.g. Sunny single room near metro)" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm" required />
                <div className="grid grid-cols-2 gap-3">
                  <input name="rent" type="number" placeholder="Rent (₹/month)" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm" required />
                  <select name="roomType" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm">
                    {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <input name="location" placeholder="Location / area, city" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm" required />
                <input name="contact" placeholder="Contact number" className="w-full px-3 py-2 rounded-md border border-ink/15 text-sm" required />

                <div>
                  <label className="text-xs font-medium text-ink/60 flex items-center gap-1 mb-1"><Upload size={12} /> Room ki photo</label>
                  <input type="file" accept="image/*" onChange={onPhotoChange} className="w-full text-sm" />
                  {photoPreview && <img src={photoPreview} alt="preview" className="mt-2 h-32 rounded-md object-cover" />}
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                <button disabled={busy} type="submit" className="w-full py-2 rounded-md bg-teal text-paper font-medium text-sm disabled:opacity-60">
                  {busy ? "Upload ho raha hai..." : "Room daalein"}
                </button>
              </form>
            </Plate>
          </div>
        )}

        {view === "mine" && session && (
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Mere listings</h2>
            {myRooms.length === 0 ? (
              <p className="text-ink/50">Abhi tak koi listing nahi. <button onClick={() => setView("add")} className="text-teal font-medium underline">Pehla room daalein</button>.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {myRooms.map((r) => (
                  <Plate key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold font-display">{r.title}</h3>
                      <button onClick={() => handleDeleteRoom(r.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                    </div>
                    <p className="text-sm text-ink/60 flex items-center gap-1 mt-1"><MapPin size={13} /> {r.location}</p>
                    <p className="text-sm mt-1 flex items-center gap-1"><IndianRupee size={13} />{Number(r.rent).toLocaleString("en-IN")}/mo · {r.room_type}</p>
                  </Plate>
                ))}
              </div>
            )}
          </div>
        )}

        {(view === "add" || view === "mine") && !session && (
          <div className="text-center py-16">
            <p className="text-ink/60 mb-3">Yeh feature use karne ke liye login karein.</p>
            <button onClick={() => setView("auth")} className="px-4 py-2 rounded-md bg-teal text-paper text-sm font-medium">Login / Sign up</button>
          </div>
        )}
      </main>
    </div>
  );
}
