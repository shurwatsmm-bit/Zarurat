import React, { useEffect, useMemo, useRef, useState } from "react";
import { Wallet, ShoppingBag, Plus, User, ShieldCheck, Trash2, MessageCircle, Search, Home, ClipboardList, ArrowRight, CheckCircle2, Clock3, XCircle, Sparkles, Lock, LogOut, RefreshCw, Phone, Banknote, Copy, Check, Landmark, BadgeCheck, Bell, LifeBuoy, Send, Users, DollarSign, Ticket as TicketIcon, Ban, UserCheck, Eye, EyeOff, BarChart3, Tag, Megaphone, FolderCog, Activity, Settings as SettingsIcon, RotateCcw, Pencil, CalendarDays, TrendingUp, Layers, Star, Gift, History, Repeat, Crown, Zap } from "lucide-react";

type UserRec = { name:string; username:string; email?:string; password:string; balance:number; createdAt:string; status?: "Active"|"Blocked"; referralCode?:string; referredBy?:string };
type ServiceRec = { name:string; category:string; pricePer1000:number; min:number; max:number; description:string; createdAt:string };
type OrderRec = { userId:string; username:string; serviceId:string; serviceName:string; link:string; quantity:number; price:number; status:"Pending"|"Completed"|"Cancelled"|"Refunded"; createdAt:string; couponCode?:string; discountPercent?:number; discountAmount?:number };
type DepositRec = { userId:string; username:string; amount:number; tid:string; note:string; status:"Pending"|"Approved"|"Rejected"; createdAt:string };
type TicketReply = { sender:"user"|"admin"; text:string; at:string };
type TicketRec = { userId:string; username:string; email:string; subject:string; message:string; status:"Open"|"Replied"|"Closed"; replies:TicketReply[]; createdAt:string };
type NotificationRec = { userId:string; title:string; message:string; readBy:string[]; createdAt:string };
type CouponRec = { code:string; discountPercent:number; expiry:string; active:boolean; createdAt:string };
type AnnouncementRec = { title:string; message:string; enabled:boolean; createdAt:string };
type CategoryRec = { name:string; createdAt:string };
type ActivityRec = { text:string; createdAt:string };
type SettingsRec = { panelName:string; minDeposit:number; supportMessage:string; referralBonusPercent?:number; updatedAt:string };
type FavoriteRec = { userId:string; serviceId:string; createdAt:string };
type TransactionRec = { userId:string; username:string; type:"Referral Bonus"|"Balance Adjustment"; title:string; amount:number; status:string; relatedId?:string; createdAt:string };

const ADMIN_KEY = "ZARORAT-ADM-2026";
const shellStyle = { boxSizing: "border-box" as const, paddingTop: "var(--safe-area-inset-top)" };

async function api(action:string, args:any){
  const res = await fetch("actions", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ action, args }) });
  const json = await res.json().catch(()=>({}));
  if(!res.ok || json.error) throw new Error(json.error || `Request failed (${res.status})`);
  return json.data;
}
async function listRecs(collection:string){
  const d = await api("records.list", { collection, limit: 100 });
  return d.records || [];
}
function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function referralCodeFor(u:{value:UserRec}){
  if(u.value.referralCode) return u.value.referralCode;
  return `ZAR-${(u.value.username||"USER").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)}`;
}
function levelFor(spent:number){
  if(spent>=20000) return { name:"VIP", next:"Top level reached", progress:100, color:"#c9a7ff" };
  if(spent>=5000) return { name:"Gold", next:"Spend Rs 20,000 for VIP", progress:Math.min(100, spent/20000*100), color:"#ffc247" };
  if(spent>=1000) return { name:"Silver", next:"Spend Rs 5,000 for Gold", progress:Math.min(100, spent/5000*100), color:"#cbd5e1" };
  return { name:"New", next:"Spend Rs 1,000 for Silver", progress:Math.min(100, spent/1000*100), color:"#7dffb8" };
}

function Inner(){
  const [screen,setScreen] = useState<"auth"|"user"|"admin">("auth");
  const [authMode,setAuthMode] = useState<"login"|"signup">("login");
  const [showAdminKey,setShowAdminKey] = useState(false);
  const [adminKey,setAdminKey] = useState("");
  const [adminError,setAdminError] = useState("");
  const [adminKeyVisible,setAdminKeyVisible] = useState(false);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<number| null>(null);
  const longPressRef = useRef<number| null>(null);
  const openAdminLogin = ()=>{ setShowAdminKey(true); setAdminError(""); };
  const handleDotTap = ()=>{
    tapCountRef.current += 1;
    if(tapCountRef.current >= 3){ tapCountRef.current = 0; if(tapTimerRef.current) window.clearTimeout(tapTimerRef.current); openAdminLogin(); return; }
    if(tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(()=>{ tapCountRef.current = 0; }, 900);
  };
  const handleDotDown = ()=>{ if(longPressRef.current) window.clearTimeout(longPressRef.current); longPressRef.current = window.setTimeout(()=>{ tapCountRef.current = 0; openAdminLogin(); }, 650); };
  const handleDotUp = ()=>{ if(longPressRef.current) window.clearTimeout(longPressRef.current); };
  const dotProps = {
    "aria-label": "Admin access",
    title: "",
    onClick: handleDotTap,
    onPointerDown: handleDotDown,
    onPointerUp: handleDotUp,
    onPointerLeave: handleDotUp,
    onContextMenu: (e:React.MouseEvent)=>e.preventDefault(),
    style: { width: 8, height: 8, borderRadius: 999, background: "#ffffff", opacity: 0.12, padding: 0, border: "none", cursor: "pointer", flexShrink: 0 } as React.CSSProperties,
  };

  const [name,setName] = useState("");
  const [username,setUsername] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [referralInput,setReferralInput] = useState("");
  const [live,setLive] = useState<"connecting"|"synced"|"offline">("connecting");
  const [lastSynced,setLastSynced] = useState("");
  const [authMsg,setAuthMsg] = useState("");
  const [busy,setBusy] = useState(false);

  const [currentUser,setCurrentUser] = useState<{id:string; value:UserRec}|null>(null);
  const [users,setUsers] = useState<{id:string; value:UserRec}[]>([]);
  const [services,setServices] = useState<{id:string; value:ServiceRec}[]>([]);
  const [orders,setOrders] = useState<{id:string; value:OrderRec}[]>([]);
  const [deposits,setDeposits] = useState<{id:string; value:DepositRec}[]>([]);
  const [tickets,setTickets] = useState<{id:string; value:TicketRec}[]>([]);
  const [notifications,setNotifications] = useState<{id:string; value:NotificationRec}[]>([]);
  const [coupons,setCoupons] = useState<{id:string; value:CouponRec}[]>([]);
  const [announcements,setAnnouncements] = useState<{id:string; value:AnnouncementRec}[]>([]);
  const [categories,setCategories] = useState<{id:string; value:CategoryRec}[]>([]);
  const [activity,setActivity] = useState<{id:string; value:ActivityRec}[]>([]);
  const [settingsRec,setSettingsRec] = useState<{id:string; value:SettingsRec}|null>(null);
  const [favorites,setFavorites] = useState<{id:string; value:FavoriteRec}[]>([]);
  const [transactions,setTransactions] = useState<{id:string; value:TransactionRec}[]>([]);
  const [dataError,setDataError] = useState("");
  const [loading,setLoading] = useState(false);
  const [notice,setNotice] = useState("");

  const [tab,setTab] = useState<"home"|"deposit"|"new"|"orders"|"profile"|"support"|"notifications"|"favorites"|"wallet">("home");
  const [adminTab,setAdminTab] = useState<"dashboard"|"services"|"categories"|"orders"|"users"|"deposits"|"tickets"|"notifications"|"coupons"|"announcements"|"activity"|"settings">("dashboard");

  const [selService,setSelService] = useState("");
  const [link,setLink] = useState("");
  const [qty,setQty] = useState("");
  const [orderMsg,setOrderMsg] = useState("");
  const [couponCode,setCouponCode] = useState("");
  const [appliedCoupon,setAppliedCoupon] = useState<{id:string; value:CouponRec}|null>(null);
  const [couponMsg,setCouponMsg] = useState("");

  const [depAmount,setDepAmount] = useState("");
  const [depTid,setDepTid] = useState("");
  const [depNote,setDepNote] = useState("");
  const [depMsg,setDepMsg] = useState("");
  const [copied,setCopied] = useState(false);
  const copyInputRef = useRef<HTMLInputElement>(null);
  const referralInputRef = useRef<HTMLInputElement>(null);
  const [referralCopied,setReferralCopied] = useState(false);

  const [sName,setSName] = useState(""); const [sCat,setSCat] = useState("Instagram"); const [sPrice,setSPrice] = useState(""); const [sMin,setSMin] = useState("100"); const [sMax,setSMax] = useState("10000"); const [sDesc,setSDesc] = useState("");
  const [balanceUser,setBalanceUser] = useState(""); const [balanceAmt,setBalanceAmt] = useState(""); const [balanceMode,setBalanceMode] = useState<"add"|"remove">("add");
  const [search,setSearch] = useState("");
  const [catFilter,setCatFilter] = useState("All");
  const [sortBy,setSortBy] = useState<"featured"|"low"|"high"|"popular">("featured");
  const [adminUserSearch,setAdminUserSearch] = useState("");
  const [userStatusFilter,setUserStatusFilter] = useState<"All"|"Active"|"Blocked"|"WithBalance">("All");
  const [deleteConfirmId,setDeleteConfirmId] = useState("");

  const [ticketSubject,setTicketSubject] = useState("");
  const [ticketMessage,setTicketMessage] = useState("");
  const [ticketMsg,setTicketMsg] = useState("");
  const [openTicketId,setOpenTicketId] = useState("");
  const [userReplyText,setUserReplyText] = useState("");
  const [adminReplyText,setAdminReplyText] = useState("");
  const [adminOpenTicketId,setAdminOpenTicketId] = useState("");
  const [ticketFilter,setTicketFilter] = useState<"All"|"Open"|"Replied"|"Closed">("All");

  const [notifTarget,setNotifTarget] = useState("all");
  const [notifTitle,setNotifTitle] = useState("");
  const [notifMessage,setNotifMessage] = useState("");
  const [notifMsg,setNotifMsg] = useState("");
  const [notifFilter,setNotifFilter] = useState<"all"|"unread">("all");

  const [cCode,setCCode] = useState(""); const [cDiscount,setCDiscount] = useState("10"); const [cExpiry,setCExpiry] = useState("");
  const [aTitle,setATitle] = useState(""); const [aMessage,setAMessage] = useState("");
  const [catName,setCatName] = useState(""); const [editingCatId,setEditingCatId] = useState(""); const [editingCatName,setEditingCatName] = useState("");
  const [mUser,setMUser] = useState(""); const [mService,setMService] = useState(""); const [mLink,setMLink] = useState(""); const [mQty,setMQty] = useState("");
  const [showAdminOrder,setShowAdminOrder] = useState(false);
  const [selectedOrders,setSelectedOrders] = useState<string[]>([]);
  const [selectedUsers,setSelectedUsers] = useState<string[]>([]);
  const [setPanelName,setSetPanelName] = useState("ZARORAT");
  const [setMinDeposit,setSetMinDeposit] = useState("50");
  const [setSupportMsg,setSetSupportMsg] = useState("Ask the admin anything. Replies appear inside your ticket.");
  const [setReferralBonus,setSetReferralBonus] = useState("5");
  const settingsLoadedRef = useRef(false);

  const [profileName,setProfileName] = useState("");
  const [editingProfile,setEditingProfile] = useState(false);
  const [profileMsg,setProfileMsg] = useState("");
  const [trackingOpenId,setTrackingOpenId] = useState("");

  const panelName = settingsRec?.value.panelName?.trim() || "ZARORAT";
  const minDeposit = settingsRec?.value.minDeposit || 50;
  const referralBonusPercent = settingsRec?.value.referralBonusPercent ?? 5;
  const supportMessage = settingsRec?.value.supportMessage?.trim() || "Ask the admin anything. Replies appear inside your ticket.";
  const defaultCats = ["Instagram","TikTok","YouTube","Facebook","Design","Website","Other"];
  const managedCats = categories.map(c=>c.value.name);
  const effectiveCats = managedCats.length ? managedCats : defaultCats;

  const reloadAll = async()=>{
    setLoading(true); setDataError(""); setLive("connecting");
    try{
      const [s,o,u,d,t,n,cp,an,ct,ac,st,fv,tx] = await Promise.all([listRecs("services"), listRecs("orders"), listRecs("users"), listRecs("deposits"), listRecs("tickets"), listRecs("notifications"), listRecs("coupons"), listRecs("announcements"), listRecs("categories"), listRecs("activity"), listRecs("settings"), listRecs("favorites"), listRecs("transactions")]);
      setServices(s); setOrders(o); setUsers(u); setDeposits(d); setTickets(t); setNotifications(n); setCoupons(cp); setAnnouncements(an); setCategories(ct); setActivity(ac); setFavorites(fv); setTransactions(tx);
      const firstSettings = (st||[])[0] || null;
      setSettingsRec(firstSettings);
      if(firstSettings && !settingsLoadedRef.current){
        settingsLoadedRef.current = true;
        setSetPanelName(firstSettings.value.panelName || "ZARORAT");
        setSetMinDeposit(String(firstSettings.value.minDeposit ?? 50));
        setSetSupportMsg(firstSettings.value.supportMessage || "Ask the admin anything. Replies appear inside your ticket.");
        setSetReferralBonus(String(firstSettings.value.referralBonusPercent ?? 5));
      }
      if(currentUser){
        const fresh = u.find((x:any)=>x.id===currentUser.id);
        if(fresh) setCurrentUser(fresh);
      }
      setLive("synced"); setLastSynced(new Date().toLocaleTimeString());
    }catch(e:any){ setDataError(e.message || "Data did not load. Please try again."); setLive("offline"); }
    setLoading(false);
  };
  useEffect(()=>{ reloadAll(); },[]);
  useEffect(()=>{
    if(screen==="auth") return;
    const t = window.setInterval(()=>{ reloadAll(); }, 5000);
    return ()=> window.clearInterval(t);
  },[screen, currentUser?.id]);

  const myOrders = useMemo(()=> orders.filter(o=> currentUser && o.value.userId===currentUser.id).sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt)),[orders,currentUser]);
  const myDeposits = useMemo(()=> deposits.filter(d=> currentUser && d.value.userId===currentUser.id).sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt)),[deposits,currentUser]);
  const myTickets = useMemo(()=> tickets.filter(t=> currentUser && t.value.userId===currentUser.id).sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt)),[tickets,currentUser]);
  const myNotifications = useMemo(()=> notifications.filter(n=> currentUser && (n.value.userId==="all" || n.value.userId===currentUser.id)).sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt)),[notifications,currentUser]);
  const unreadCount = useMemo(()=> myNotifications.filter(n=> !(n.value.readBy||[]).includes(currentUser?.id || "")).length,[myNotifications,currentUser]);
  const filteredNotifications = useMemo(()=> notifFilter==="unread" ? myNotifications.filter(n=> !(n.value.readBy||[]).includes(currentUser?.id || "")) : myNotifications,[myNotifications, notifFilter, currentUser]);
  const myFavorites = useMemo(()=> favorites.filter(f=> currentUser && f.value.userId===currentUser.id),[favorites,currentUser]);
  const favoriteServiceIds = useMemo(()=> new Set(myFavorites.map(f=>f.value.serviceId)),[myFavorites]);
  const favoriteServices = useMemo(()=> services.filter(s=> favoriteServiceIds.has(s.id)),[services, favoriteServiceIds]);
  const orderCountByService = useMemo(()=>{ const m=new Map<string,number>(); orders.forEach(o=> m.set(o.value.serviceId,(m.get(o.value.serviceId)||0)+1)); return m; },[orders]);

  const visibleServices = useMemo(()=>{
    let list = services.filter(s=> (catFilter==="All" || s.value.category===catFilter) && s.value.name.toLowerCase().includes(search.toLowerCase()));
    if(sortBy==="low") list=[...list].sort((a,b)=>a.value.pricePer1000-b.value.pricePer1000);
    if(sortBy==="high") list=[...list].sort((a,b)=>b.value.pricePer1000-a.value.pricePer1000);
    if(sortBy==="popular") list=[...list].sort((a,b)=> (orderCountByService.get(b.id)||0)-(orderCountByService.get(a.id)||0));
    return list;
  },[services,catFilter,search,sortBy,orderCountByService]);

  const cats = useMemo(()=> ["All", ...Array.from(new Set([...effectiveCats, ...services.map(s=>s.value.category)]))],[services, effectiveCats]);
  const selectedService = services.find(s=>s.id===selService);
  const estPrice = selectedService && qty ? Math.ceil((Number(qty)||0)/1000 * selectedService.value.pricePer1000) : 0;
  const couponDiscountAmount = appliedCoupon ? Math.floor(estPrice * appliedCoupon.value.discountPercent / 100) : 0;
  const finalPrice = Math.max(0, estPrice - couponDiscountAmount);
  const isBlocked = currentUser ? (currentUser.value.status === "Blocked") : false;
  const activeAnnouncements = useMemo(()=> announcements.filter(a=>a.value.enabled).sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt)),[announcements]);

  const myTotalSpent = useMemo(()=> myOrders.filter(o=>o.value.status!=="Cancelled" && o.value.status!=="Refunded").reduce((s,o)=>s+o.value.price,0),[myOrders]);
  const myCompleted = useMemo(()=> myOrders.filter(o=>o.value.status==="Completed").length,[myOrders]);
  const myPending = useMemo(()=> myOrders.filter(o=>o.value.status==="Pending").length,[myOrders]);
  const myThisMonth = useMemo(()=>{ const now=new Date(); return myOrders.filter(o=>{ const d=new Date(o.value.createdAt); return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth(); }).length; },[myOrders]);
  const myLevel = levelFor(myTotalSpent);
  const myReferralCode = currentUser ? referralCodeFor(currentUser) : "";
  const myReferrals = useMemo(()=> users.filter(u=> currentUser && u.value.referredBy===currentUser.id).sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt)),[users,currentUser]);
  const myReferralEarnings = useMemo(()=> transactions.filter(t=> currentUser && t.value.userId===currentUser.id && t.value.type==="Referral Bonus").reduce((s,t)=>s+t.value.amount,0),[transactions,currentUser]);

  const walletHistory = useMemo(()=>{
    type Row={id:string; date:string; title:string; detail:string; amount:number; status:string};
    const rows:Row[]=[];
    myDeposits.forEach(d=> rows.push({id:`dep-${d.id}`, date:d.value.createdAt, title:"Deposit — Easypaisa", detail:`TID ${d.value.tid}`, amount:d.value.amount, status:d.value.status}));
    myOrders.forEach(o=>{
      rows.push({id:`ord-${o.id}`, date:o.value.createdAt, title:`Order — ${o.value.serviceName}`, detail:`Qty ${o.value.quantity}`, amount:-o.value.price, status:o.value.status});
      if((o.value.discountAmount||0)>0) rows.push({id:`coup-${o.id}`, date:o.value.createdAt, title:"Coupon Discount", detail:o.value.couponCode||"Coupon", amount:o.value.discountAmount||0, status:"Applied"});
      if(o.value.status==="Refunded") rows.push({id:`ref-${o.id}`, date:o.value.createdAt, title:`Refund — ${o.value.serviceName}`, detail:"Returned to balance", amount:o.value.price, status:"Refunded"});
    });
    transactions.filter(t=> currentUser && t.value.userId===currentUser.id).forEach(t=> rows.push({id:`tx-${t.id}`, date:t.value.createdAt, title:t.value.title, detail:t.value.type, amount:t.value.amount, status:t.value.status}));
    return rows.sort((a,b)=> b.date.localeCompare(a.date));
  },[myDeposits,myOrders,transactions,currentUser]);

  const analytics7 = useMemo(()=>{
    const days:{label:string; count:number; revenue:number}[]=[];
    const start=new Date(); start.setHours(0,0,0,0);
    for(let i=6;i>=0;i--){ const d=new Date(start); d.setDate(d.getDate()-i); const label=d.toLocaleDateString(undefined,{weekday:"short"}); const dayOrders=myOrders.filter(o=>{ const od=new Date(o.value.createdAt); return od.toDateString()===d.toDateString(); }); days.push({label, count:dayOrders.length, revenue:dayOrders.filter(o=>o.value.status==="Completed").reduce((s,o)=>s+o.value.price,0)}); }
    return days;
  },[myOrders]);
  const maxDayCount = Math.max(1, ...analytics7.map(d=>d.count));

  const pushNotification = async(userId:string, title:string, message:string)=>{
    try{ await api("records.create", { collection:"notifications", value:{ userId, title, message, readBy:[], createdAt:new Date().toISOString() }, idempotency_key:`notif-${userId}-${Date.now()}-${uid()}` }); }catch{ }
  };
  const logActivity = async(text:string)=>{
    try{ await api("records.create", { collection:"activity", value:{ text, createdAt:new Date().toISOString() }, idempotency_key:`act-${Date.now()}-${uid()}` }); }catch{ }
  };
  const pushTransaction = async(userId:string, username:string, type:TransactionRec["type"], title:string, amount:number, status:string)=>{
    try{ await api("records.create", { collection:"transactions", value:{ userId, username, type, title, amount, status, createdAt:new Date().toISOString() }, idempotency_key:`tx-${userId}-${Date.now()}-${uid()}` }); }catch{ }
  };
  const awardReferralBonus = async(buyer:{id:string; value:UserRec}, orderPrice:number)=>{
    try{
      if(!buyer.value.referredBy) return;
      const allUsers = await listRecs("users");
      const referrer:any = allUsers.find((x:any)=>x.id===buyer.value.referredBy);
      if(!referrer) return;
      const bonus = Math.floor(orderPrice * referralBonusPercent / 100);
      if(!bonus || bonus<=0) return;
      await api("records.replace", { collection:"users", id:referrer.id, value:{ ...referrer.value, balance:(referrer.value.balance||0)+bonus } });
      await pushTransaction(referrer.id, referrer.value.username, "Referral Bonus", `Referral bonus from @${buyer.value.username}`, bonus, "Paid");
      await pushNotification(referrer.id, "Referral Bonus Earned", `You earned Rs ${bonus} referral bonus from @${buyer.value.username}'s order (${referralBonusPercent}%).`);
      await logActivity(`Referral bonus Rs ${bonus} to @${referrer.value.username} from @${buyer.value.username}`);
    }catch{ }
  };

  const doAuth = async(e:React.FormEvent)=>{
    e.preventDefault(); setAuthMsg(""); setBusy(true);
    try{
      const cleanEmail = email.trim().toLowerCase();
      if(!cleanEmail.includes("@") || !cleanEmail.includes(".")) throw new Error("Enter a valid email address.");
      if(password.length<4) throw new Error("Password must be at least 4 characters.");
      const all = await listRecs("users");
      setUsers(all);
      const derivedUsername = cleanEmail.split("@")[0] || "user";
      if(authMode==="signup"){
        if(!name.trim()) throw new Error("Enter your name, email, and a password of at least 4 characters.");
        if(all.some((u:any)=>(u.value.email||"").toLowerCase()===cleanEmail || u.value.username.toLowerCase()===derivedUsername.toLowerCase())) throw new Error("An account with this email already exists. Please log in instead.");
        let referredBy = "";
        let referrer:any = null;
        const code = referralInput.trim().toUpperCase();
        if(code){
          referrer = all.find((u:any)=> referralCodeFor(u)===code);
          if(!referrer) throw new Error("That referral code is not valid. Check it and try again, or leave it empty.");
          referredBy = referrer.id;
        }
        const myCode = `ZAR-${derivedUsername.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6)}${uid().slice(0,4).toUpperCase()}`;
        const created = await api("records.create", { collection:"users", value:{ name:name.trim(), username:derivedUsername, email:cleanEmail, password, balance:0, status:"Active", referralCode:myCode, referredBy, createdAt:new Date().toISOString() }, idempotency_key:`user-${cleanEmail}-${uid()}` });
        setCurrentUser(created); setScreen("user"); setTab("home"); setAuthMsg("Account created. Welcome!");
        await logActivity(`New user signed up: @${derivedUsername}${referrer ? ` (referred by @${referrer.value.username})` : ""}`);
        if(referrer) await pushNotification(referrer.id, "New Referral", `@${derivedUsername} signed up with your referral code. You earn ${referralBonusPercent}% on their orders.`);
      } else {
        const found = all.find((u:any)=>((u.value.email||"").toLowerCase()===cleanEmail || u.value.username.toLowerCase()===cleanEmail) && u.value.password===password);
        if(!found) throw new Error("Email or password is incorrect. Check your details and try again.");
        if((found.value.status || "Active") === "Blocked") throw new Error("Your account is blocked. Contact support.");
        setCurrentUser(found); setScreen("user"); setTab("home");
      }
      await reloadAll();
    }catch(err:any){ setAuthMsg(err.message); }
    setBusy(false);
  };

  const logout = ()=>{ setCurrentUser(null); setScreen("auth"); setUsername(""); setEmail(""); setPassword(""); setReferralInput(""); setNotice("Logged out."); };

  const applyCoupon = ()=>{
    setCouponMsg("");
    const code = couponCode.trim().toLowerCase();
    if(!code){ setCouponMsg("Enter a coupon code first."); return; }
    const found = coupons.find(c=>c.value.code.toLowerCase()===code);
    if(!found){ setCouponMsg("This coupon code is not valid."); setAppliedCoupon(null); return; }
    if(!found.value.active){ setCouponMsg("This coupon is disabled."); setAppliedCoupon(null); return; }
    if(found.value.expiry && new Date(found.value.expiry) < new Date(new Date().toDateString())){ setCouponMsg("This coupon has expired."); setAppliedCoupon(null); return; }
    setAppliedCoupon(found); setCouponMsg(`Coupon applied — ${found.value.discountPercent}% off.`);
  };

  const toggleFavorite = async(serviceId:string)=>{
    if(!currentUser) return;
    const existing = myFavorites.find(f=>f.value.serviceId===serviceId);
    try{
      if(existing){ await api("records.delete", { collection:"favorites", id:existing.id }); }
      else { await api("records.create", { collection:"favorites", value:{ userId:currentUser.id, serviceId, createdAt:new Date().toISOString() }, idempotency_key:`fav-${currentUser.id}-${serviceId}` }); }
      await reloadAll();
    }catch(e:any){ setNotice(e.message); }
  };

  const startReorder = (o:{value:OrderRec})=>{
    setSelService(o.value.serviceId); setLink(o.value.link); setQty(String(o.value.quantity)); setCouponCode(""); setAppliedCoupon(null); setCouponMsg(""); setOrderMsg(""); setTab("new");
  };

  const saveProfileName = async()=>{
    if(!currentUser) return;
    const nm = profileName.trim();
    if(!nm){ setProfileMsg("Enter a display name."); return; }
    setBusy(true);
    try{
      await api("records.replace", { collection:"users", id:currentUser.id, value:{ ...currentUser.value, name:nm } });
      setProfileMsg("Display name updated.");
      setEditingProfile(false);
      await reloadAll();
    }catch(e:any){ setProfileMsg(e.message); }
    setBusy(false);
  };

  const copyReferralCode = ()=>{
    const el = referralInputRef.current;
    if(el){ el.focus(); el.select(); try{ document.execCommand("copy"); setReferralCopied(true); }catch{ setReferralCopied(false); } window.setTimeout(()=>setReferralCopied(false), 2000); }
  };

  const placeOrder = async(e:React.FormEvent)=>{
    e.preventDefault(); setOrderMsg(""); if(!currentUser) return;
    if(isBlocked){ setOrderMsg("Your account is blocked. Contact support."); return; }
    if(!selectedService){ setOrderMsg("Please select a service first. No service is available yet."); return; }
    const q = Number(qty);
    if(!link.trim().startsWith("http")){ setOrderMsg("Enter a valid link — it must start with http / https."); return; }
    if(!q || q < selectedService.value.min || q > selectedService.value.max){ setOrderMsg(`Quantity must be between ${selectedService.value.min} and ${selectedService.value.max}.`); return; }
    if(currentUser.value.balance < finalPrice){ setOrderMsg(`Balance is low. You need Rs ${finalPrice}, and your balance is Rs ${currentUser.value.balance}. Ask the admin to add balance.`); return; }
    setBusy(true);
    try{
      await api("records.create", { collection:"orders", value:{ userId:currentUser.id, username:currentUser.value.username, serviceId:selectedService.id, serviceName:selectedService.value.name, link:link.trim(), quantity:q, price:finalPrice, status:"Pending", couponCode: appliedCoupon ? appliedCoupon.value.code : "", discountPercent: appliedCoupon ? appliedCoupon.value.discountPercent : 0, discountAmount: couponDiscountAmount, createdAt:new Date().toISOString() }, idempotency_key:`order-${currentUser.id}-${Date.now()}` });
      await api("records.replace", { collection:"users", id:currentUser.id, value:{ ...currentUser.value, balance: currentUser.value.balance - finalPrice } });
      await awardReferralBonus(currentUser, finalPrice);
      await logActivity(`User @${currentUser.value.username} placed order: ${selectedService.value.name} (Qty ${q}, Rs ${finalPrice})`);
      setOrderMsg("Order received! Processing starts shortly. Check the status in Orders.");
      setLink(""); setQty(""); setSelService(""); setCouponCode(""); setAppliedCoupon(null); setCouponMsg("");
      await reloadAll(); setTab("orders");
    }catch(err:any){ setOrderMsg(err.message); }
    setBusy(false);
  };

  const copyNumber = ()=>{
    const el = copyInputRef.current;
    if(el){ el.focus(); el.select(); try{ document.execCommand("copy"); setCopied(true); }catch{ setCopied(false); } window.setTimeout(()=>setCopied(false), 2000); }
  };

  const submitDeposit = async(e:React.FormEvent)=>{
    e.preventDefault(); setDepMsg(""); if(!currentUser) return;
    if(isBlocked){ setDepMsg("Your account is blocked. Contact support."); return; }
    const amt = Number(depAmount);
    if(!amt || amt <= 0){ setDepMsg("Enter a valid amount greater than 0."); return; }
    if(amt < minDeposit){ setDepMsg(`Minimum deposit is Rs ${minDeposit}.`); return; }
    if(!depTid.trim()){ setDepMsg("Enter your Transaction ID (TID)."); return; }
    setBusy(true);
    try{
      await api("records.create", { collection:"deposits", value:{ userId:currentUser.id, username:currentUser.value.username, amount:amt, tid:depTid.trim(), note:depNote.trim(), status:"Pending", createdAt:new Date().toISOString() }, idempotency_key:`dep-${currentUser.id}-${Date.now()}` });
      await logActivity(`User @${currentUser.value.username} requested deposit: Rs ${amt} (TID ${depTid.trim()})`);
      setDepMsg("Deposit request submitted! Status: Pending. Admin will approve it and add your balance.");
      setDepAmount(""); setDepTid(""); setDepNote("");
      await reloadAll();
    }catch(err:any){ setDepMsg(err.message); }
    setBusy(false);
  };

  const createTicket = async(e:React.FormEvent)=>{
    e.preventDefault(); setTicketMsg(""); if(!currentUser) return;
    if(!ticketSubject.trim() || !ticketMessage.trim()){ setTicketMsg("Enter a subject and a message."); return; }
    setBusy(true);
    try{
      await api("records.create", { collection:"tickets", value:{ userId:currentUser.id, username:currentUser.value.username, email:currentUser.value.email || "", subject:ticketSubject.trim(), message:ticketMessage.trim(), status:"Open", replies:[], createdAt:new Date().toISOString() }, idempotency_key:`ticket-${currentUser.id}-${Date.now()}` });
      await logActivity(`User @${currentUser.value.username} opened ticket: ${ticketSubject.trim()}`);
      setTicketMsg("Ticket created. Admin will reply here.");
      setTicketSubject(""); setTicketMessage("");
      await reloadAll();
    }catch(err:any){ setTicketMsg(err.message); }
    setBusy(false);
  };
  const replyToTicketAsUser = async(ticket:{id:string; value:TicketRec})=>{
    if(!userReplyText.trim()) return;
    setBusy(true);
    try{
      const replies = [...(ticket.value.replies||[]), { sender:"user" as const, text:userReplyText.trim(), at:new Date().toISOString() }];
      await api("records.replace", { collection:"tickets", id:ticket.id, value:{ ...ticket.value, replies, status: "Open" } });
      setUserReplyText(""); await reloadAll();
    }catch(err:any){ setTicketMsg(err.message); }
    setBusy(false);
  };
  const markNotificationRead = async(n:{id:string; value:NotificationRec})=>{
    if(!currentUser) return;
    if((n.value.readBy||[]).includes(currentUser.id)) return;
    try{ await api("records.replace", { collection:"notifications", id:n.id, value:{ ...n.value, readBy:[...(n.value.readBy||[]), currentUser.id] } }); await reloadAll(); }catch{}
  };
  const markAllNotificationsRead = async()=>{
    if(!currentUser) return;
    setBusy(true);
    try{
      for(const n of myNotifications){
        if(!(n.value.readBy||[]).includes(currentUser.id)){
          await api("records.replace", { collection:"notifications", id:n.id, value:{ ...n.value, readBy:[...(n.value.readBy||[]), currentUser.id] } });
        }
      }
      await reloadAll();
    }catch{} setBusy(false);
  };

  const approveDeposit = async(d:{id:string; value:DepositRec})=>{
    const u = users.find(x=>x.id===d.value.userId);
    if(!u){ setNotice("That user was not found. Deposit was not approved."); return; }
    setBusy(true);
    try{
      await api("records.replace", { collection:"users", id:u.id, value:{ ...u.value, balance: u.value.balance + d.value.amount } });
      await api("records.replace", { collection:"deposits", id:d.id, value:{ ...d.value, status:"Approved" } });
      await pushNotification(d.value.userId, "Deposit Approved", `Your deposit of Rs ${d.value.amount} was approved. Rs ${d.value.amount} has been added to your balance.`);
      await logActivity(`Admin approved deposit: Rs ${d.value.amount} for @${u.value.username}`);
      setNotice(`Deposit approved — Rs ${d.value.amount} added to @${u.value.username}.`);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const rejectDeposit = async(d:{id:string; value:DepositRec})=>{
    setBusy(true);
    try{
      await api("records.replace", { collection:"deposits", id:d.id, value:{ ...d.value, status:"Rejected" } });
      await pushNotification(d.value.userId, "Deposit Rejected", `Your deposit of Rs ${d.value.amount} (TID: ${d.value.tid}) was rejected. No balance was added. Contact support if this is a mistake.`);
      await logActivity(`Admin rejected deposit: Rs ${d.value.amount} from @${d.value.username}`);
      setNotice(`Deposit rejected — Rs ${d.value.amount} from @${d.value.username}. No balance was added.`);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };

  const addService = async(e:React.FormEvent)=>{
    e.preventDefault(); setNotice("");
    if(!sName.trim() || !sPrice || !sMin || !sMax){ setNotice("Service name, price, min, and max are required."); return; }
    setBusy(true);
    try{
      await api("records.create", { collection:"services", value:{ name:sName.trim(), category:sCat, pricePer1000:Number(sPrice), min:Number(sMin), max:Number(sMax), description:sDesc.trim(), createdAt:new Date().toISOString() }, idempotency_key:`svc-${sName.trim().toLowerCase()}-${uid()}` });
      await logActivity(`Admin added service: ${sName.trim()} (${sCat})`);
      setSName(""); setSPrice(""); setSDesc(""); setNotice("Service added. It will now be visible to users.");
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const deleteService = async(id:string)=>{
    try{ await api("records.delete", { collection:"services", id }); await logActivity(`Admin deleted a service`); setNotice("Service deleted."); await reloadAll(); }catch(e:any){ setNotice(e.message); }
  };
  const updateOrderStatus = async(o:{id:string; value:OrderRec}, status:OrderRec["status"])=>{
    try{
      await api("records.replace", { collection:"orders", id:o.id, value:{ ...o.value, status } });
      await pushNotification(o.value.userId, `Order ${status}`, `Your order “${o.value.serviceName}” (Qty ${o.value.quantity}) is now ${status}.`);
      await logActivity(`Admin marked order as ${status}: ${o.value.serviceName} for @${o.value.username}`);
      setNotice(`Order marked as ${status}.`);
      await reloadAll();
    }catch(e:any){ setNotice(e.message); }
  };
  const refundOrder = async(o:{id:string; value:OrderRec})=>{
    const u = users.find(x=>x.id===o.value.userId);
    if(!u){ setNotice("That user was not found. Refund was not processed."); return; }
    setBusy(true);
    try{
      await api("records.replace", { collection:"users", id:u.id, value:{ ...u.value, balance: u.value.balance + o.value.price } });
      await api("records.replace", { collection:"orders", id:o.id, value:{ ...o.value, status:"Refunded" } });
      await pushNotification(o.value.userId, "Order Refunded", `Your order “${o.value.serviceName}” was refunded. Rs ${o.value.price} has been returned to your balance.`);
      await logActivity(`Admin refunded order: Rs ${o.value.price} returned to @${u.value.username} (${o.value.serviceName})`);
      setNotice(`Order refunded — Rs ${o.value.price} returned to @${u.value.username}.`);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const createAdminOrder = async(e:React.FormEvent)=>{
    e.preventDefault(); setNotice("");
    const u = users.find(x=>x.id===mUser); const svc = services.find(x=>x.id===mService);
    if(!u || !svc){ setNotice("Select a user and a service."); return; }
    const q = Number(mQty);
    if(!mLink.trim().startsWith("http")){ setNotice("Enter a valid link — it must start with http / https."); return; }
    if(!q || q < svc.value.min || q > svc.value.max){ setNotice(`Quantity must be between ${svc.value.min} and ${svc.value.max}.`); return; }
    const price = Math.ceil(q/1000 * svc.value.pricePer1000);
    if(u.value.balance < price){ setNotice(`@${u.value.username} has Rs ${u.value.balance} but needs Rs ${price}. Add balance first.`); return; }
    setBusy(true);
    try{
      await api("records.create", { collection:"orders", value:{ userId:u.id, username:u.value.username, serviceId:svc.id, serviceName:svc.value.name, link:mLink.trim(), quantity:q, price, status:"Pending", createdAt:new Date().toISOString() }, idempotency_key:`admin-order-${u.id}-${Date.now()}` });
      await api("records.replace", { collection:"users", id:u.id, value:{ ...u.value, balance: u.value.balance - price } });
      await awardReferralBonus(u, price);
      await pushNotification(u.id, "Order Created by Admin", `Admin created an order for you: “${svc.value.name}” (Qty ${q}, Rs ${price}).`);
      await logActivity(`Admin created order: ${svc.value.name} (Qty ${q}, Rs ${price}) for @${u.value.username}`);
      setNotice(`Order created for @${u.value.username} — Rs ${price} deducted from balance.`);
      setMLink(""); setMQty(""); setShowAdminOrder(false);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const bulkUpdateOrders = async(status:"Completed"|"Cancelled")=>{
    if(selectedOrders.length===0) return;
    setBusy(true);
    try{
      for(const id of selectedOrders){
        const o = orders.find(x=>x.id===id); if(!o) continue;
        await api("records.replace", { collection:"orders", id:o.id, value:{ ...o.value, status } });
        await pushNotification(o.value.userId, `Order ${status}`, `Your order “${o.value.serviceName}” (Qty ${o.value.quantity}) is now ${status}.`);
      }
      await logActivity(`Admin bulk-updated ${selectedOrders.length} order(s) to ${status}`);
      setNotice(`${selectedOrders.length} order(s) marked as ${status}.`);
      setSelectedOrders([]);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const bulkUpdateUsers = async(status:"Active"|"Blocked")=>{
    if(selectedUsers.length===0) return;
    setBusy(true);
    try{
      for(const id of selectedUsers){
        const u = users.find(x=>x.id===id); if(!u) continue;
        await api("records.replace", { collection:"users", id:u.id, value:{ ...u.value, status } });
        await pushNotification(u.id, status==="Blocked" ? "Account Blocked" : "Account Unblocked", status==="Blocked" ? "Your account has been blocked. Contact support for help." : "Your account has been unblocked. You can log in and place orders again.");
      }
      await logActivity(`Admin bulk ${status==="Blocked" ? "blocked" : "unblocked"} ${selectedUsers.length} user(s)`);
      setNotice(`${selectedUsers.length} user(s) ${status==="Blocked" ? "blocked" : "unblocked"}.`);
      setSelectedUsers([]);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const addBalance = async(e:React.FormEvent)=>{
    e.preventDefault(); const u = users.find(x=>x.id===balanceUser); if(!u || !balanceAmt){ setNotice("Select a user and an amount."); return; }
    const amt = Number(balanceAmt);
    if(!amt || amt <= 0){ setNotice("Enter an amount greater than 0."); return; }
    setBusy(true);
    try{
      const newBalance = balanceMode==="add" ? u.value.balance + amt : Math.max(0, u.value.balance - amt);
      await api("records.replace", { collection:"users", id:u.id, value:{ ...u.value, balance:newBalance } });
      await pushTransaction(u.id, u.value.username, "Balance Adjustment", balanceMode==="add" ? "Balance added by admin" : "Balance removed by admin", balanceMode==="add" ? amt : -amt, "Completed");
      await pushNotification(u.id, balanceMode==="add" ? "Balance Added" : "Balance Removed", balanceMode==="add" ? `Rs ${amt} was added to your balance by admin. New balance: Rs ${newBalance}.` : `Rs ${amt} was removed from your balance by admin. New balance: Rs ${newBalance}.`);
      await logActivity(`Admin ${balanceMode==="add" ? "added" : "removed"} Rs ${amt} ${balanceMode==="add" ? "to" : "from"} @${u.value.username} (new balance Rs ${newBalance})`);
      setNotice(balanceMode==="add" ? `Rs ${amt} added — ${u.value.username}'s balance is now Rs ${newBalance}.` : `Rs ${amt} removed — ${u.value.username}'s balance is now Rs ${newBalance}.`);
      setBalanceAmt(""); await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const setUserStatus = async(u:{id:string; value:UserRec}, status:"Active"|"Blocked")=>{
    setBusy(true);
    try{
      await api("records.replace", { collection:"users", id:u.id, value:{ ...u.value, status } });
      if(status==="Blocked") await pushNotification(u.id, "Account Blocked", "Your account has been blocked. Contact support for help.");
      else await pushNotification(u.id, "Account Unblocked", "Your account has been unblocked. You can log in and place orders again.");
      await logActivity(`Admin ${status==="Blocked" ? "blocked" : "unblocked"} user @${u.value.username}`);
      setNotice(status==="Blocked" ? `@${u.value.username} has been blocked.` : `@${u.value.username} has been unblocked.`);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const deleteUser = async(u:{id:string; value:UserRec})=>{
    setBusy(true);
    try{ await api("records.delete", { collection:"users", id:u.id }); await logActivity(`Admin deleted user @${u.value.username}`); setNotice(`User @${u.value.username} deleted.`); setDeleteConfirmId(""); await reloadAll(); }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const replyToTicketAsAdmin = async(ticket:{id:string; value:TicketRec})=>{
    if(!adminReplyText.trim()){ setNotice("Write a reply first."); return; }
    setBusy(true);
    try{
      const replies = [...(ticket.value.replies||[]), { sender:"admin" as const, text:adminReplyText.trim(), at:new Date().toISOString() }];
      await api("records.replace", { collection:"tickets", id:ticket.id, value:{ ...ticket.value, replies, status:"Replied" } });
      await pushNotification(ticket.value.userId, "Ticket Reply", `Admin replied to your ticket “${ticket.value.subject}”. Open Support to read it.`);
      await logActivity(`Admin replied to ticket from @${ticket.value.username}: ${ticket.value.subject}`);
      setAdminReplyText(""); setNotice("Reply sent to the user."); await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const setTicketStatus = async(ticket:{id:string; value:TicketRec}, status:TicketRec["status"])=>{
    try{ await api("records.replace", { collection:"tickets", id:ticket.id, value:{ ...ticket.value, status } }); await logActivity(`Admin marked ticket as ${status}: ${ticket.value.subject}`); setNotice(`Ticket marked as ${status}.`); await reloadAll(); }catch(err:any){ setNotice(err.message); }
  };
  const sendAdminNotification = async(e:React.FormEvent)=>{
    e.preventDefault(); setNotifMsg("");
    if(!notifTitle.trim() || !notifMessage.trim()){ setNotifMsg("Enter a title and a message."); return; }
    setBusy(true);
    try{
      await pushNotification(notifTarget, notifTitle.trim(), notifMessage.trim());
      await logActivity(`Admin sent notification: ${notifTitle.trim()}`);
      setNotifMsg(notifTarget==="all" ? "Notification sent to all users." : "Notification sent to the selected user.");
      setNotifTitle(""); setNotifMessage(""); await reloadAll();
    }catch(err:any){ setNotifMsg(err.message); }
    setBusy(false);
  };

  const addCoupon = async(e:React.FormEvent)=>{
    e.preventDefault(); setNotice("");
    const code = cCode.trim().toUpperCase();
    if(!code || !cDiscount){ setNotice("Enter a coupon code and a discount %."); return; }
    const pct = Number(cDiscount);
    if(!pct || pct <= 0 || pct > 100){ setNotice("Discount must be between 1 and 100 %."); return; }
    if(coupons.some(c=>c.value.code.toLowerCase()===code.toLowerCase())){ setNotice("This coupon code already exists."); return; }
    setBusy(true);
    try{
      await api("records.create", { collection:"coupons", value:{ code, discountPercent:pct, expiry:cExpiry || "", active:true, createdAt:new Date().toISOString() }, idempotency_key:`coupon-${code}-${uid()}` });
      await logActivity(`Admin created coupon ${code} — ${pct}% off`);
      setCCode(""); setCDiscount("10"); setCExpiry(""); setNotice(`Coupon ${code} created.`);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const toggleCoupon = async(c:{id:string; value:CouponRec})=>{
    try{ await api("records.replace", { collection:"coupons", id:c.id, value:{ ...c.value, active:!c.value.active } }); setNotice(`Coupon ${c.value.code} ${!c.value.active ? "enabled" : "disabled"}.`); await reloadAll(); }catch(e:any){ setNotice(e.message); }
  };
  const deleteCoupon = async(id:string)=>{
    try{ await api("records.delete", { collection:"coupons", id }); await logActivity(`Admin deleted a coupon`); setNotice("Coupon deleted."); await reloadAll(); }catch(e:any){ setNotice(e.message); }
  };

  const addAnnouncement = async(e:React.FormEvent)=>{
    e.preventDefault(); setNotice("");
    if(!aTitle.trim() || !aMessage.trim()){ setNotice("Enter an announcement title and message."); return; }
    setBusy(true);
    try{
      await api("records.create", { collection:"announcements", value:{ title:aTitle.trim(), message:aMessage.trim(), enabled:true, createdAt:new Date().toISOString() }, idempotency_key:`ann-${Date.now()}-${uid()}` });
      await logActivity(`Admin created announcement: ${aTitle.trim()}`);
      setATitle(""); setAMessage(""); setNotice("Announcement created and enabled.");
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const toggleAnnouncement = async(a:{id:string; value:AnnouncementRec})=>{
    try{ await api("records.replace", { collection:"announcements", id:a.id, value:{ ...a.value, enabled:!a.value.enabled } }); setNotice(`Announcement ${!a.value.enabled ? "enabled" : "disabled"}.`); await reloadAll(); }catch(e:any){ setNotice(e.message); }
  };
  const deleteAnnouncement = async(id:string)=>{
    try{ await api("records.delete", { collection:"announcements", id }); setNotice("Announcement deleted."); await reloadAll(); }catch(e:any){ setNotice(e.message); }
  };

  const addCategory = async(e:React.FormEvent)=>{
    e.preventDefault(); setNotice("");
    const nm = catName.trim();
    if(!nm){ setNotice("Enter a category name."); return; }
    if(effectiveCats.some(c=>c.toLowerCase()===nm.toLowerCase())){ setNotice("This category already exists."); return; }
    setBusy(true);
    try{
      await api("records.create", { collection:"categories", value:{ name:nm, createdAt:new Date().toISOString() }, idempotency_key:`cat-${nm.toLowerCase()}-${uid()}` });
      await logActivity(`Admin added category: ${nm}`);
      setCatName(""); setNotice(`Category “${nm}” added.`); await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const saveCategoryEdit = async(c:{id:string; value:CategoryRec})=>{
    const nm = editingCatName.trim();
    if(!nm){ setNotice("Enter a category name."); return; }
    setBusy(true);
    try{
      await api("records.replace", { collection:"categories", id:c.id, value:{ ...c.value, name:nm } });
      for(const s of services.filter(s=>s.value.category===c.value.name)){
        await api("records.replace", { collection:"services", id:s.id, value:{ ...s.value, category:nm } });
      }
      await logActivity(`Admin renamed category ${c.value.name} to ${nm}`);
      setEditingCatId(""); setNotice(`Category renamed to “${nm}”. Services were moved too.`);
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };
  const deleteCategory = async(c:{id:string; value:CategoryRec})=>{
    if(services.some(s=>s.value.category===c.value.name)){ setNotice(`Cannot delete “${c.value.name}” — services still use it. Move or delete those services first.`); return; }
    try{ await api("records.delete", { collection:"categories", id:c.id }); await logActivity(`Admin deleted category: ${c.value.name}`); setNotice("Category deleted."); await reloadAll(); }catch(e:any){ setNotice(e.message); }
  };

  const saveSettings = async(e:React.FormEvent)=>{
    e.preventDefault(); setNotice("");
    const nm = setPanelName.trim() || "ZARORAT";
    const min = Number(setMinDeposit);
    const bonus = Number(setReferralBonus);
    if(!min || min < 0){ setNotice("Enter a valid minimum deposit."); return; }
    if(isNaN(bonus) || bonus < 0 || bonus > 100){ setNotice("Referral bonus must be between 0 and 100 %."); return; }
    setBusy(true);
    try{
      const val:SettingsRec = { panelName:nm, minDeposit:min, supportMessage:setSupportMsg.trim() || "Ask the admin anything. Replies appear inside your ticket.", referralBonusPercent:bonus, updatedAt:new Date().toISOString() };
      if(settingsRec) await api("records.replace", { collection:"settings", id:settingsRec.id, value:val });
      else await api("records.create", { collection:"settings", value:val, idempotency_key:`settings-${uid()}` });
      await logActivity(`Admin updated settings: panel “${nm}”, min deposit Rs ${min}, referral bonus ${bonus}%`);
      setNotice("Settings saved and reflected in the panel.");
      await reloadAll();
    }catch(err:any){ setNotice(err.message); }
    setBusy(false);
  };

  const depositStatusChip = (status:string)=> status==="Approved" ? "!text-[#7dffb8] !border-[#1f4a35] !bg-[#0f2a1e]" : status==="Rejected" ? "!text-[#ff8a94] !border-[#4a1a20] !bg-[#2a1013]" : "!text-[#ffd88a] !border-[#4a3a1a] !bg-[#2a230f]";
  const ticketStatusChip = (status:string)=> status==="Open" ? "!text-[#ffd88a] !border-[#4a3a1a] !bg-[#2a230f]" : status==="Replied" ? "!text-[#7dc8ff] !border-[#1a2f4a] !bg-[#0f1f2f]" : "!text-[#7dffb8] !border-[#1f4a35] !bg-[#0f2a1e]";

  const filteredAdminUsers = useMemo(()=>{
    const q = adminUserSearch.trim().toLowerCase();
    return [...users].sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt)).filter(u=> {
      const matchesQ = !q || (u.value.email||"").toLowerCase().includes(q) || u.value.username.toLowerCase().includes(q) || u.value.name.toLowerCase().includes(q);
      const matchesStatus = userStatusFilter==="All" ? true : userStatusFilter==="WithBalance" ? u.value.balance > 0 : (u.value.status || "Active")===userStatusFilter;
      return matchesQ && matchesStatus;
    });
  },[users, adminUserSearch, userStatusFilter]);
  const filteredAdminTickets = useMemo(()=>{
    const list = [...tickets].sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt));
    return ticketFilter==="All" ? list : list.filter(t=>t.value.status===ticketFilter);
  },[tickets, ticketFilter]);
  const totalRevenue = useMemo(()=> orders.filter(o=>o.value.status==="Completed").reduce((sum,o)=> sum + (o.value.price||0), 0),[orders]);
  const blockedCount = users.filter(u=> (u.value.status||"Active")==="Blocked").length;
  const openTicketsCount = tickets.filter(t=>t.value.status==="Open" || t.value.status==="Replied").length;
  const pendingDepositsCount = deposits.filter(d=>d.value.status==="Pending").length;

  const analytics = useMemo(()=>{
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate()-6);
    const completed = orders.filter(o=>o.value.status==="Completed");
    const revToday = completed.filter(o=> new Date(o.value.createdAt) >= startOfToday).reduce((s,o)=>s+o.value.price,0);
    const revWeek = completed.filter(o=> new Date(o.value.createdAt) >= startOfWeek).reduce((s,o)=>s+o.value.price,0);
    const revMonth = completed.filter(o=>{ const d=new Date(o.value.createdAt); return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth(); }).reduce((s,o)=>s+o.value.price,0);
    const days: {label:string; count:number; revenue:number}[] = [];
    for(let i=6;i>=0;i--){ const d=new Date(startOfToday); d.setDate(d.getDate()-i); const label=d.toLocaleDateString(undefined,{weekday:"short"}); const dayOrders=orders.filter(o=>{ const od=new Date(o.value.createdAt); return od.toDateString()===d.toDateString(); }); days.push({label, count:dayOrders.length, revenue:dayOrders.filter(o=>o.value.status==="Completed").reduce((s,o)=>s+o.value.price,0)}); }
    const byService = new Map<string,{name:string; count:number; revenue:number}>();
    orders.forEach(o=>{ const cur=byService.get(o.value.serviceName)||{name:o.value.serviceName,count:0,revenue:0}; cur.count+=1; if(o.value.status==="Completed") cur.revenue+=o.value.price; byService.set(o.value.serviceName,cur); });
    const topServices = [...byService.values()].sort((a,b)=> b.count-a.count).slice(0,5);
    const newUsersWeek = users.filter(u=> new Date(u.value.createdAt) >= startOfWeek);
    const maxCount = Math.max(1, ...days.map(d=>d.count));
    return { revToday, revWeek, revMonth, days, topServices, newUsersWeek, maxCount };
  },[orders, users]);

  const trackingFor = (status:string)=>{
    if(status==="Completed") return { steps:["Placed","Processing","In Progress","Completed"], active:3, progress:100, label:"Completed" };
    if(status==="Cancelled") return { steps:["Placed","Cancelled"], active:1, progress:100, label:"Cancelled" };
    if(status==="Refunded") return { steps:["Placed","Refunded"], active:1, progress:100, label:"Refunded" };
    return { steps:["Placed","Processing","In Progress","Completed"], active:1, progress:35, label:"Processing" };
  };

  const renderServiceCard = (s:{id:string; value:ServiceRec})=>{
    const fav = favoriteServiceIds.has(s.id);
    const pop = orderCountByService.get(s.id)||0;
    return <div key={s.id} className="glass rounded-2xl p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><span className="chip !py-1 !px-2.5 !text-[11px] !bg-[#0f2a1e] !border-[#1f4a35] text-[#7dffb8]">{s.value.category}</span><p className="font-bold mt-2 truncate">{s.value.name}</p><p className="text-xs text-[var(--muted)]">Min {s.value.min} • Max {s.value.max}{pop>0 ? ` • ${pop} order${pop===1?"":"s"}` : ""}</p>{s.value.description && <p className="text-sm text-[var(--muted)] mt-1.5 leading-relaxed">{s.value.description}</p>}</div><div className="flex flex-col items-end gap-2 shrink-0"><p className="font-display font-bold text-[var(--green)] whitespace-nowrap">Rs {s.value.pricePer1000}<span className="block text-[11px] text-[var(--muted)] font-sans font-normal text-right">/ 1000</span></p><button onClick={()=>toggleFavorite(s.id)} aria-label={fav ? `Remove ${s.value.name} from favorites` : `Save ${s.value.name} to favorites`} className={`w-9 h-9 rounded-xl flex items-center justify-center border ${fav ? "bg-[#2a230f] border-[#4a3a1a] text-[#ffc247]" : "bg-[#0e1a14] border-[var(--line)] text-[var(--muted)]"}`}><Star size={18} fill={fav ? "#ffc247" : "none"}/></button></div></div><button onClick={()=>{ setSelService(s.id); setTab("new"); }} className="grad w-full mt-3 py-2.5 rounded-xl text-sm font-bold">Order This Service</button></div>;
  };

  if(screen==="auth"){
    return (
      <div style={{minHeight:"100vh"}} className="overflow-x-clip relative">
        <div className="mx-auto max-w-[430px] px-5 pb-10 relative">
          <div className="flex justify-end pt-3"><button {...dotProps} /></div>
          <div className="flex items-center gap-2 pt-2"><div className="w-9 h-9 rounded-xl grad flex items-center justify-center font-display font-bold text-lg">Z</div><div><p className="font-display font-bold leading-none">{panelName}</p><p className="text-[11px] tracking-[0.22em] text-[var(--muted)]">SMM PANEL</p></div></div>

          {showAdminKey && <div className="mt-4 glass rounded-2xl p-4">
            <p className="label">Admin Access</p><p className="text-sm text-[var(--muted)] mt-1">Enter the admin key, then the Admin Panel will open.</p>
            <div className="flex gap-2 mt-3"><div className="relative flex-1"><input type={adminKeyVisible?"text":"password"} className="input !pr-11" value={adminKey} onChange={e=>setAdminKey(e.target.value)} placeholder="Admin key" /><button type="button" aria-label={adminKeyVisible?"Hide admin key":"Show admin key"} onClick={()=>setAdminKeyVisible(!adminKeyVisible)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]">{adminKeyVisible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div><button onClick={()=>{ if(adminKey.trim()===ADMIN_KEY){ setScreen("admin"); setAdminTab("dashboard"); setAdminError(""); reloadAll(); } else setAdminError("Admin key is incorrect."); }} className="grad rounded-xl px-4 font-bold text-sm shrink-0">Open</button></div>
            {adminError && <p className="text-sm text-[var(--danger)] mt-2">{adminError}</p>}
            <button onClick={()=>setShowAdminKey(false)} className="text-xs text-[var(--muted)] underline mt-3">Close admin login</button>
          </div>}

          <div className="mt-10 text-center">
            <span className="chip !bg-[#0f2a1e] !border-[#1f4a35] text-[#7dffb8]">✦ FAST PROCESSING • LIVE SYNC • SECURE DELIVERY</span>
            {live!=="synced" && <p className="mt-3 text-sm text-[#ffd88a] bg-[#2a230f] border border-[#4a3a1a] rounded-xl px-3 py-2">Connecting to the panel… Please wait a moment and try again. <button onClick={reloadAll} className="underline font-bold">Retry</button></p>}
            {live==="synced" && <p className="mt-3 text-xs text-[var(--muted)]"><span className="text-[#7dffb8]">● Live - Synced</span>{lastSynced ? ` • Last synced ${lastSynced}` : ""}</p>}
            <h1 className="font-display font-bold leading-[0.95] mt-5 break-words" style={{fontSize:"clamp(36px,10.5vw,64px)", overflowWrap:"anywhere"}}>Your Need,<br/><span className="grad-text">Our Responsibility.</span></h1>
            <p className="text-[var(--muted)] mt-4 text-[15px] leading-relaxed">A simple, empty, and clean panel. Place your order — <b className="text-white">fast &amp; secure processing starts within minutes.</b></p>
          </div>

          <div className="glass rounded-[22px] p-4 mt-7">
            <div className="grid grid-cols-2 bg-[#08110e] rounded-xl p-1 border border-[var(--line)]">
              {(["login","signup"] as const).map(m=><button key={m} onClick={()=>setAuthMode(m)} className={`py-2.5 rounded-lg text-sm font-bold ${authMode===m?"grad":"text-[var(--muted)]"}`}>{m==="login"?"Login":"Sign Up"}</button>)}
            </div>
            <form onSubmit={doAuth} className="mt-4 space-y-3">
              {authMode==="signup" && <div><label className="label">Full Name</label><input className="input mt-1.5" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" /></div>}
              <div><label className="label">Email</label><input type="email" className="input mt-1.5" value={email} onChange={e=>setEmail(e.target.value)} placeholder="e.g. you@example.com" autoComplete="email" /></div>
              <div><label className="label">Password</label><input type="password" className="input mt-1.5" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></div>
              {authMode==="signup" && <div><label className="label">Referral Code (Optional)</label><input className="input mt-1.5 uppercase" value={referralInput} onChange={e=>setReferralInput(e.target.value.toUpperCase())} placeholder="e.g. ZAR-ABC123" /><p className="text-xs text-[var(--muted)] mt-1.5">If a friend invited you, enter their code. They earn {referralBonusPercent}% on your orders.</p></div>}
              {authMsg && <p className="text-sm text-[#ffb3ba] bg-[#2a1013] border border-[#4a1a20] rounded-xl px-3 py-2">{authMsg}</p>}
              <button disabled={busy} className="grad w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2">{busy?"Please wait...":authMode==="login"?"Log In":"Create Account"} <ArrowRight size={17}/></button>
              <p className="text-center text-xs text-[var(--muted)]">Everything starts empty — Balance <b className="text-white">0</b>, Orders <b className="text-white">0</b>.</p>
            </form>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-4">
            {[{n:"0",l:"Fake Services"},{n:"0",l:"Fake Orders"},{n:"0",l:"Fake Balance"}].map(x=><div key={x.l} className="glass rounded-2xl p-3 text-center"><p className="font-display font-bold text-xl">{x.n}</p><p className="text-[11px] text-[var(--muted)] leading-tight mt-0.5">{x.l}</p></div>)}
          </div>
          <div className="mt-4 rounded-2xl border border-[#2a3a1a] bg-[#141a08] p-4 flex gap-3"><Sparkles className="text-[var(--lime)] shrink-0" size={20}/><p className="text-sm leading-relaxed text-[#e8f5c8]"><b>Fast Processing:</b> Orders start within minutes with verified, secure processing.</p></div>
          <div className="mt-6 flex items-center justify-between"><p className="text-center text-[11px] text-[var(--muted)]">{panelName} SMM Panel • Empty, clean, and honest from the start.</p><button {...dotProps} /></div>
        </div>
      </div>
    );
  }

  if(screen==="admin"){
    const pending = orders.filter(o=>o.value.status==="Pending").length;
    const pendingDeposits = deposits.filter(d=>d.value.status==="Pending");
    const sortedDeposits = [...deposits].sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt));
    const sortedOrders = [...orders].sort((a,b)=> b.value.createdAt.localeCompare(a.value.createdAt));
    const adminOrderSvc = services.find(s=>s.id===mService);
    const adminOrderPrice = adminOrderSvc && mQty ? Math.ceil((Number(mQty)||0)/1000 * adminOrderSvc.value.pricePer1000) : 0;
    return (
      <div style={{minHeight:"100vh"}} className="overflow-x-clip">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 pb-16">
          <header data-safe-area-sticky-top style={{top:"var(--safe-area-inset-top)"}} className="sticky z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[#050b09]/90 backdrop-blur border-b border-[var(--line)]">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl grad flex items-center justify-center font-display font-bold">Z</div><div><p className="font-display font-bold leading-none">{panelName} <span className="text-[var(--green)]">ADMIN PRO</span></p><p className="text-[11px] text-[var(--muted)]">Control Panel • {live==="synced" ? <span className="text-[#7dffb8]">● Live - Synced</span> : live==="connecting" ? "● Connecting…" : "● Offline — retrying"}</p></div></div><button onClick={()=>setScreen("auth")} className="chip flex items-center gap-1"><LogOut size={14}/> Exit Admin</button></div>
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">{(["dashboard","services","categories","orders","deposits","users","tickets","notifications","coupons","announcements","activity","settings"] as const).map(t=><button key={t} onClick={()=>setAdminTab(t)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${adminTab===t?"grad":"bg-[#0e1a14] border border-[var(--line)]"}`}>{t==="dashboard"?"Analytics":t==="services"?"Services":t==="categories"?"Categories":t==="orders"?`Orders ${pending?`(${pending} pending)`:``}`:t==="deposits"?`Deposits ${pendingDeposits.length?`(${pendingDeposits.length} pending)`:``}`:t==="users"?`Users ${blockedCount?`(${blockedCount} blocked)`:``}`:t==="tickets"?`Tickets ${openTicketsCount?`(${openTicketsCount} open)`:``}`:t==="notifications"?"Notifications":t==="coupons"?"Coupons":t==="announcements"?"Announcements":t==="activity"?"Activity Log":"Settings"}</button>)}</div>
          </header>

          {notice && <div className="mt-4 bg-[#0f2a1e] border border-[#1f4a35] text-[#bfffd9] rounded-xl px-4 py-3 text-sm flex justify-between gap-3"><span>{notice}</span><button onClick={()=>setNotice("")} className="font-bold">✕</button></div>}
          {dataError && <p className="mt-3 text-sm text-[#ffb3ba]">{dataError} <button onClick={reloadAll} className="underline font-bold">Load Again</button></p>}

          {adminTab==="dashboard" && <div className="mt-5">
            <div className="flex items-end justify-between gap-3 flex-wrap"><div><h2 className="font-display font-bold text-2xl sm:text-3xl">Analytics Dashboard</h2><p className="text-sm text-[var(--muted)] mt-1">Live totals from the panel — nothing is fake.</p></div><button onClick={reloadAll} className="chip flex items-center gap-1"><RefreshCw size={13}/> Refresh</button></div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><CalendarDays size={14}/> TODAY REVENUE</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1">Rs {analytics.revToday}</p><p className="text-xs text-[var(--muted)]">Completed orders today</p></div>
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><TrendingUp size={14}/> WEEK REVENUE</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1">Rs {analytics.revWeek}</p><p className="text-xs text-[var(--muted)]">Last 7 days</p></div>
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><DollarSign size={14}/> MONTH REVENUE</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1">Rs {analytics.revMonth}</p><p className="text-xs text-[var(--muted)]">This month • Total Rs {totalRevenue}</p></div>
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><Users size={14}/> TOTAL USERS</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1">{users.length}</p><p className="text-xs text-[var(--muted)]">{blockedCount} blocked • {analytics.newUsersWeek.length} new this week</p></div>
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><ShoppingBag size={14}/> TOTAL ORDERS</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1">{orders.length}</p><p className="text-xs text-[var(--muted)]">{pending} pending</p></div>
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><Banknote size={14}/> PENDING DEPOSITS</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1 text-[#ffd88a]">{pendingDepositsCount}</p><p className="text-xs text-[var(--muted)]">Waiting for approval</p></div>
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><TicketIcon size={14}/> OPEN TICKETS</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1 text-[#7dc8ff]">{openTicketsCount}</p><p className="text-xs text-[var(--muted)]">{tickets.length} total tickets</p></div>
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><Tag size={14}/> ACTIVE COUPONS</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1">{coupons.filter(c=>c.value.active).length}</p><p className="text-xs text-[var(--muted)]">{coupons.length} coupons total</p></div>
              <div className="glass rounded-2xl p-4"><div className="flex items-center gap-1.5 text-xs text-[var(--muted)] font-bold"><Megaphone size={14}/> ANNOUNCEMENTS</div><p className="font-display font-bold text-2xl sm:text-3xl mt-1">{announcements.filter(a=>a.value.enabled).length}</p><p className="text-xs text-[var(--muted)]">Enabled banners on user dashboard</p></div>
            </div>
            <div className="grid lg:grid-cols-2 gap-3 mt-3">
              <div className="glass rounded-[22px] p-5"><div className="flex items-center gap-2"><BarChart3 size={18} className="text-[var(--green)]"/><h3 className="font-display font-bold text-lg">Orders — Last 7 Days</h3></div>
                {orders.length===0 ? <p className="text-sm text-[var(--muted)] mt-4">No orders yet. The chart will fill as orders arrive.</p>
                : <div className="mt-5"><div className="flex items-end gap-2 sm:gap-3 h-32">{analytics.days.map((d,i)=><div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0"><span className="text-[11px] font-bold">{d.count}</span><div className="w-full rounded-t-lg grad" style={{height:`${Math.max(6, d.count/analytics.maxCount*100)}%`, minHeight:6, opacity: i===6 ? 1 : 0.55}} title={`${d.label}: ${d.count} orders, Rs ${d.revenue}`}/><span className="text-[10px] text-[var(--muted)]">{d.label}</span></div>)}</div><p className="text-xs text-[var(--muted)] mt-3">Bar = orders per day. Hover a bar for revenue.</p></div>}
              </div>
              <div className="glass rounded-[22px] p-5"><div className="flex items-center gap-2"><Layers size={18} className="text-[var(--green)]"/><h3 className="font-display font-bold text-lg">Top Services</h3></div>
                {analytics.topServices.length===0 ? <p className="text-sm text-[var(--muted)] mt-4">No orders yet.</p> : <div className="space-y-3 mt-4">{analytics.topServices.map((s,idx)=><div key={s.name}><div className="flex justify-between text-sm gap-2"><span className="font-bold truncate">#{idx+1} {s.name}</span><span className="text-[var(--muted)] shrink-0">{s.count} orders • Rs {s.revenue}</span></div><div className="h-2 rounded-full bg-[#08110e] mt-1.5 overflow-hidden"><div className="h-full grad rounded-full" style={{width:`${Math.max(6, s.count/Math.max(1,analytics.topServices[0].count)*100)}%`}}/></div></div>)}</div>}
              </div>
            </div>
            <div className="glass rounded-[22px] p-5 mt-3"><h3 className="font-display font-bold text-lg">New Users — This Week ({analytics.newUsersWeek.length})</h3>
              {analytics.newUsersWeek.length===0 ? <p className="text-sm text-[var(--muted)] mt-2">No new users in the last 7 days.</p> : <div className="space-y-2 mt-3">{analytics.newUsersWeek.slice(0,5).map(u=><div key={u.id} className="flex justify-between gap-2 text-sm flex-wrap"><span className="font-bold truncate">{u.value.name} (@{u.value.username})</span><span className="text-[var(--muted)]">{new Date(u.value.createdAt).toLocaleDateString()}</span></div>)}</div>}
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <button onClick={()=>setAdminTab("orders")} className="glass rounded-2xl p-4 text-left"><p className="font-bold">Review Orders →</p><p className="text-xs text-[var(--muted)] mt-1">{pending} pending orders to approve.</p></button>
              <button onClick={()=>setAdminTab("tickets")} className="glass rounded-2xl p-4 text-left"><p className="font-bold">Reply to Tickets →</p><p className="text-xs text-[var(--muted)] mt-1">{openTicketsCount} open tickets waiting.</p></button>
              <button onClick={()=>setAdminTab("notifications")} className="glass rounded-2xl p-4 text-left"><p className="font-bold">Send Notification →</p><p className="text-xs text-[var(--muted)] mt-1">To all users or one user.</p></button>
            </div>
          </div>}

          {adminTab==="services" && <div className="grid lg:grid-cols-[380px_1fr] gap-4 mt-4 items-start">
            <form onSubmit={addService} className="glass rounded-[22px] p-5 space-y-3">
              <h2 className="font-display font-bold text-xl">Add Service</h2>
              <div><label className="label">Service Name</label><input className="input mt-1.5" value={sName} onChange={e=>setSName(e.target.value)} placeholder="e.g. Instagram Followers"/></div>
              <div><label className="label">Category</label><select className="input mt-1.5" value={sCat} onChange={e=>setSCat(e.target.value)}>{effectiveCats.map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-2"><div><label className="label">Price / 1000</label><input type="number" min="1" className="input mt-1.5" value={sPrice} onChange={e=>setSPrice(e.target.value)} placeholder="Rs"/></div><div><label className="label">Min</label><input type="number" className="input mt-1.5" value={sMin} onChange={e=>setSMin(e.target.value)}/></div><div><label className="label">Max</label><input type="number" className="input mt-1.5" value={sMax} onChange={e=>setSMax(e.target.value)}/></div></div>
              <div><label className="label">Description</label><textarea className="input mt-1.5" rows={3} value={sDesc} onChange={e=>setSDesc(e.target.value)} placeholder="Delivery time, quality, notes..."/></div>
              <button disabled={busy} className="grad w-full py-3 rounded-xl font-bold">+ Add Service</button>
              <button type="button" onClick={()=>setAdminTab("categories")} className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#0e1a14] border border-[var(--line)] flex items-center justify-center gap-1.5"><FolderCog size={15}/> Manage Categories</button>
            </form>
            <div>
              <div className="flex items-center justify-between mb-3"><h3 className="font-display font-bold text-lg">Services List</h3><button onClick={reloadAll} className="chip flex items-center gap-1"><RefreshCw size={13}/> Refresh</button></div>
              {services.length===0 ? <div className="glass rounded-[22px] p-8 text-center"><div className="w-14 h-14 mx-auto rounded-2xl bg-[#0e1a14] flex items-center justify-center text-2xl">📦</div><h4 className="font-bold mt-4">No services yet</h4><p className="text-sm text-[var(--muted)] mt-1">Ask the admin to add a service — add the first service using the form above.</p></div>
              : <div className="space-y-3">{services.map(s=><div key={s.id} className="glass rounded-2xl p-4 flex gap-3 justify-between"><div className="min-w-0"><p className="font-bold truncate">{s.value.name}</p><p className="text-xs text-[var(--muted)] mt-0.5">{s.value.category} • Min {s.value.min} • Max {s.value.max}</p><p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">{s.value.description || "No description."}</p></div><div className="text-right shrink-0"><p className="font-display font-bold text-[var(--green)]">Rs {s.value.pricePer1000} / 1k</p><button onClick={()=>deleteService(s.id)} className="mt-2 text-xs font-bold text-[#ff8a94] border border-[#4a1a20] bg-[#2a1013] px-3 py-1.5 rounded-lg flex items-center gap-1 ml-auto"><Trash2 size={13}/> Delete</button></div></div>)}</div>}
            </div>
          </div>}

          {adminTab==="categories" && <div className="grid lg:grid-cols-[380px_1fr] gap-4 mt-4 items-start">
            <form onSubmit={addCategory} className="glass rounded-[22px] p-5 space-y-3">
              <h2 className="font-display font-bold text-xl">Add Category</h2>
              <p className="text-sm text-[var(--muted)]">Categories group services. Users filter services by category.</p>
              <div><label className="label">Category Name</label><input className="input mt-1.5" value={catName} onChange={e=>setCatName(e.target.value)} placeholder="e.g. Design"/></div>
              <button disabled={busy} className="grad w-full py-3 rounded-xl font-bold">+ Add Category</button>
              <div className="flex flex-wrap gap-2 pt-1">{effectiveCats.map(c=><span key={c} className="chip">{c} • {services.filter(s=>s.value.category===c).length} services</span>)}</div>
            </form>
            <div>
              <h3 className="font-display font-bold text-lg mb-3">Categories ({effectiveCats.length})</h3>
              {effectiveCats.length===0 ? <p className="text-sm text-[var(--muted)]">No categories yet.</p> : <div className="space-y-3">{effectiveCats.map(cName=>{
                const catRec = categories.find(c=>c.value.name===cName);
                const count = services.filter(s=>s.value.category===cName).length;
                const editing = catRec && editingCatId===catRec.id;
                return <div key={cName} className="glass rounded-2xl p-4 flex justify-between gap-3 items-center flex-wrap">
                  {editing ? <div className="flex gap-2 flex-1 min-w-[220px]"><input className="input" value={editingCatName} onChange={e=>setEditingCatName(e.target.value)} /><button disabled={busy} onClick={()=>catRec && saveCategoryEdit(catRec)} className="grad rounded-xl px-4 font-bold text-sm shrink-0">Save</button><button onClick={()=>setEditingCatId("")} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)]">Cancel</button></div>
                  : <div className="min-w-0"><p className="font-bold">{cName}</p><p className="text-xs text-[var(--muted)]">{count} service{count===1?"":"s"}</p></div>}
                  {!editing && <div className="flex gap-2 shrink-0">{catRec ? <><button onClick={()=>{ setEditingCatId(catRec.id); setEditingCatName(catRec.value.name); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)] flex items-center gap-1"><Pencil size={13}/> Edit</button><button onClick={()=>deleteCategory(catRec)} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94] flex items-center gap-1"><Trash2 size={13}/> Delete</button></> : <span className="chip">Default</span>}</div>}
                </div>;
              })}</div>}
              <p className="text-xs text-[var(--muted)] mt-3">Default categories are shown until you add your own. Editing a saved category also moves its services to the new name. A category with services cannot be deleted.</p>
            </div>
          </div>}

          {adminTab==="orders" && <div className="mt-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3"><h3 className="font-display font-bold text-xl">Orders</h3><button onClick={()=>setShowAdminOrder(!showAdminOrder)} className="grad px-4 py-2.5 rounded-xl text-sm font-bold">{showAdminOrder ? "Hide Create Order" : "+ Create Order"}</button></div>
            {showAdminOrder && <form onSubmit={createAdminOrder} className="glass rounded-[22px] p-5 space-y-3 mb-4">
              <h4 className="font-display font-bold text-lg">Create Order</h4><p className="text-sm text-[var(--muted)]">The price is deducted from the selected user&apos;s balance.</p>
              <div className="grid sm:grid-cols-2 gap-3"><div><label className="label">Select User</label><select className="input mt-1.5" value={mUser} onChange={e=>setMUser(e.target.value)}><option value="">— Choose a user —</option>{users.map(u=><option key={u.id} value={u.id}>{u.value.name} (@{u.value.username}) — Rs {u.value.balance}</option>)}</select></div><div><label className="label">Select Service</label><select className="input mt-1.5" value={mService} onChange={e=>setMService(e.target.value)}><option value="">— Choose a service —</option>{services.map(s=><option key={s.id} value={s.id}>{s.value.name} — Rs {s.value.pricePer1000}/1000</option>)}</select></div></div>
              <div><label className="label">Link</label><input className="input mt-1.5" value={mLink} onChange={e=>setMLink(e.target.value)} placeholder="https://..." /></div>
              <div className="grid sm:grid-cols-2 gap-3"><div><label className="label">Quantity</label><input type="number" className="input mt-1.5" value={mQty} onChange={e=>setMQty(e.target.value)} placeholder="e.g. 1000" /></div><div><label className="label">Price</label><div className="input mt-1.5 bg-[#08110e] font-bold">Rs {adminOrderPrice}</div></div></div>
              {adminOrderSvc && <p className="text-xs text-[var(--muted)]">Min {adminOrderSvc.value.min} • Max {adminOrderSvc.value.max} • Rs {adminOrderSvc.value.pricePer1000} / 1000</p>}
              <button disabled={busy} className="grad px-5 py-3 rounded-xl font-bold">Create Order</button>
            </form>}
            {selectedOrders.length>0 && <div className="glass rounded-2xl p-4 mb-3 flex items-center gap-2 flex-wrap"><span className="text-sm font-bold">{selectedOrders.length} order(s) selected</span><button disabled={busy} onClick={()=>bulkUpdateOrders("Completed")} className="grad px-4 py-2 rounded-lg text-xs font-bold">Mark Completed Together</button><button disabled={busy} onClick={()=>bulkUpdateOrders("Cancelled")} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94]">Mark Cancelled Together</button><button onClick={()=>setSelectedOrders([])} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)]">Clear</button></div>}
            {orders.length===0 ? <div className="glass rounded-[22px] p-8 text-center"><ClipboardList className="mx-auto text-[var(--muted)]" size={36}/><h4 className="font-bold mt-3">No orders yet</h4><p className="text-sm text-[var(--muted)] mt-1">When a user places an order, it will appear here. You can update it to Pending / Completed / Cancelled.</p></div>
            : <div className="space-y-3">{sortedOrders.map(o=><div key={o.id} className="glass rounded-2xl p-4"><div className="flex justify-between gap-3 flex-wrap"><div className="flex gap-3 min-w-0"><input type="checkbox" aria-label={`Select order ${o.value.serviceName}`} checked={selectedOrders.includes(o.id)} onChange={e=> setSelectedOrders(prev=> e.target.checked ? [...prev, o.id] : prev.filter(x=>x!==o.id))} className="mt-1 w-4 h-4 accent-[#00e676] shrink-0"/><div className="min-w-0"><p className="font-bold">{o.value.serviceName}</p><p className="text-xs text-[var(--muted)]">@{o.value.username} • Qty {o.value.quantity} • Rs {o.value.price}{o.value.couponCode ? ` • Coupon ${o.value.couponCode} (-Rs ${o.value.discountAmount||0})` : ""}</p></div></div><span className={`chip h-fit ${o.value.status==="Completed"?"!text-[#7dffb8] !border-[#1f4a35] !bg-[#0f2a1e]":o.value.status==="Cancelled"?"!text-[#ff8a94] !border-[#4a1a20] !bg-[#2a1013]":o.value.status==="Refunded"?"!text-[#c9a7ff] !border-[#2a1a4a] !bg-[#1a0f2f]":"!text-[#ffd88a] !border-[#4a3a1a] !bg-[#2a230f]"}`}>{o.value.status}</span></div><a href={o.value.link} target="_blank" rel="noopener" className="text-sm text-[#7dc8ff] break-all block mt-2 underline decoration-dotted">{o.value.link}</a><div className="flex gap-2 mt-3 flex-wrap">{(["Pending","Completed","Cancelled"] as const).map(st=><button key={st} disabled={o.value.status===st} onClick={()=>updateOrderStatus(o,st)} className={`px-3 py-2 rounded-lg text-xs font-bold ${o.value.status===st?"grad":"bg-[#0e1a14] border border-[var(--line)]"}`}>{st}</button>)}<button disabled={busy || o.value.status==="Refunded" || o.value.status==="Cancelled"} onClick={()=>refundOrder(o)} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#1a0f2f] border border-[#2a1a4a] text-[#c9a7ff] flex items-center gap-1 disabled:opacity-50"><RotateCcw size={13}/> Refund</button></div></div>)}</div>}
          </div>}

          {adminTab==="deposits" && <div className="mt-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3"><h3 className="font-display font-bold text-xl">Deposit Requests</h3><button onClick={reloadAll} className="chip flex items-center gap-1"><RefreshCw size={13}/> Refresh</button></div>
            <p className="text-sm text-[var(--muted)] mb-4">Check the Easypaisa payment first. Approve adds the amount to that user&apos;s balance. Reject adds nothing.</p>
            {sortedDeposits.length===0 ? <div className="glass rounded-[22px] p-8 text-center"><Banknote className="mx-auto text-[var(--muted)]" size={36}/><h4 className="font-bold mt-3">No deposit requests yet</h4><p className="text-sm text-[var(--muted)] mt-1">When a user submits a deposit, it will appear here as Pending.</p></div>
            : <div className="space-y-3">{sortedDeposits.map(d=><div key={d.id} className="glass rounded-2xl p-4 sm:p-5"><div className="flex justify-between gap-3 flex-wrap items-start"><div className="min-w-0"><p className="font-display font-bold text-2xl">Rs {d.value.amount}</p><p className="text-sm mt-1">@{d.value.username} • {new Date(d.value.createdAt).toLocaleString()}</p><p className="text-sm mt-2 break-all"><span className="text-[var(--muted)]">Transaction ID (TID): </span><b className="tracking-wide">{d.value.tid}</b></p>{d.value.note && <p className="text-sm text-[var(--muted)] mt-1 break-words">Note: {d.value.note}</p>}</div><span className={`chip h-fit flex items-center gap-1 ${depositStatusChip(d.value.status)}`}>{d.value.status==="Approved"?<CheckCircle2 size={13}/>:d.value.status==="Rejected"?<XCircle size={13}/>:<Clock3 size={13}/>}{d.value.status}</span></div>{d.value.status==="Pending" && <div className="flex gap-2 mt-4 flex-wrap"><button disabled={busy} onClick={()=>approveDeposit(d)} className="grad px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"><BadgeCheck size={16}/> Approve &amp; Add Balance</button><button disabled={busy} onClick={()=>rejectDeposit(d)} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94] disabled:opacity-50">Reject</button></div>}</div>)}</div>}
          </div>}

          {adminTab==="users" && <div className="mt-4">
            <div className="flex items-end justify-between gap-3 flex-wrap"><div><h3 className="font-display font-bold text-xl">Users &amp; Balance</h3><p className="text-sm text-[var(--muted)] mt-1">{users.length} users • {blockedCount} blocked • Search by email, name, or username.</p></div><button onClick={reloadAll} className="chip flex items-center gap-1"><RefreshCw size={13}/> Refresh</button></div>
            {selectedUsers.length>0 && <div className="glass rounded-2xl p-4 mt-3 flex items-center gap-2 flex-wrap"><span className="text-sm font-bold">{selectedUsers.length} user(s) selected</span><button disabled={busy} onClick={()=>bulkUpdateUsers("Blocked")} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94]">Block Together</button><button disabled={busy} onClick={()=>bulkUpdateUsers("Active")} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0f2a1e] border border-[#1f4a35] text-[#7dffb8]">Unblock Together</button><button onClick={()=>setSelectedUsers([])} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)]">Clear</button></div>}
            <div className="grid lg:grid-cols-[380px_1fr] gap-4 mt-4 items-start">
              <form onSubmit={addBalance} className="glass rounded-[22px] p-5 space-y-3"><h2 className="font-display font-bold text-xl">Edit Balance</h2><div><label className="label">Select User</label><select className="input mt-1.5" value={balanceUser} onChange={e=>setBalanceUser(e.target.value)}><option value="">— Choose a user —</option>{users.map(u=><option key={u.id} value={u.id}>{u.value.name} (@{u.value.username}) — Rs {u.value.balance}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setBalanceMode("add")} className={`py-2.5 rounded-xl text-sm font-bold ${balanceMode==="add"?"grad":"bg-[#0e1a14] border border-[var(--line)]"}`}>+ Add Balance</button><button type="button" onClick={()=>setBalanceMode("remove")} className={`py-2.5 rounded-xl text-sm font-bold ${balanceMode==="remove"?"bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94]":"bg-[#0e1a14] border border-[var(--line)]"}`}>− Remove Balance</button></div><div><label className="label">Amount (Rs)</label><input type="number" min="1" className="input mt-1.5" value={balanceAmt} onChange={e=>setBalanceAmt(e.target.value)} placeholder="e.g. 500"/></div><button disabled={busy} className="grad w-full py-3 rounded-xl font-bold">{balanceMode==="add" ? "Add Balance" : "Remove Balance"}</button><p className="text-xs text-[var(--muted)]">The user&apos;s dashboard will update as soon as balance is changed. The user also gets a notification.</p></form>
              <div>
                <div className="flex gap-2 flex-wrap"><div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17}/><input className="input !pl-10" value={adminUserSearch} onChange={e=>setAdminUserSearch(e.target.value)} placeholder="Search users by email, name, username..."/></div><select className="input !w-auto" value={userStatusFilter} onChange={e=>setUserStatusFilter(e.target.value as any)}><option value="All">All Users</option><option value="Active">Active Only</option><option value="Blocked">Blocked Only</option><option value="WithBalance">With Balance</option></select></div>
                <p className="text-xs text-[var(--muted)] mt-2 mb-3">Showing {filteredAdminUsers.length} of {users.length} users.</p>
                {filteredAdminUsers.length===0 ? <div className="glass rounded-[22px] p-8 text-center"><User className="mx-auto text-[var(--muted)]"/><h4 className="font-bold mt-3">{users.length===0 ? "No users yet" : "No users match this search"}</h4><p className="text-sm text-[var(--muted)] mt-1">{users.length===0 ? "When someone signs up, they will be listed here." : "Try a different email, name, username, or filter."}</p></div> : <div className="space-y-3">{filteredAdminUsers.map(u=>{
                  const orderCount = orders.filter(o=>o.value.userId===u.id).length;
                  const status = u.value.status || "Active";
                  const isDeleting = deleteConfirmId===u.id;
                  return <div key={u.id} className="glass rounded-2xl p-4">
                    <div className="flex justify-between items-start gap-3 flex-wrap"><div className="flex gap-3 min-w-0"><input type="checkbox" aria-label={`Select user ${u.value.username}`} checked={selectedUsers.includes(u.id)} onChange={e=> setSelectedUsers(prev=> e.target.checked ? [...prev, u.id] : prev.filter(x=>x!==u.id))} className="mt-1 w-4 h-4 accent-[#00e676] shrink-0"/><div className="min-w-0"><p className="font-bold truncate">{u.value.name}</p><p className="text-xs text-[var(--muted)] break-all">@{u.value.username} • {u.value.email || "No email"} • Referral: {referralCodeFor(u)}</p><p className="text-xs text-[var(--muted)] mt-1">Joined {new Date(u.value.createdAt).toLocaleDateString()} • {orderCount} order{orderCount===1?"":"s"}</p></div></div><div className="text-right shrink-0"><p className="font-display font-bold">Rs {u.value.balance}</p><span className={`chip inline-flex mt-1.5 ${status==="Blocked"?"!text-[#ff8a94] !border-[#4a1a20] !bg-[#2a1013]":"!text-[#7dffb8] !border-[#1f4a35] !bg-[#0f2a1e]"}`}>{status}</span></div></div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button onClick={()=>{ setBalanceUser(u.id); setBalanceMode("add"); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)]">Edit Balance</button>
                      {status==="Active" ? <button disabled={busy} onClick={()=>setUserStatus(u,"Blocked")} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94] flex items-center gap-1"><Ban size={13}/> Block User</button> : <button disabled={busy} onClick={()=>setUserStatus(u,"Active")} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0f2a1e] border border-[#1f4a35] text-[#7dffb8] flex items-center gap-1"><UserCheck size={13}/> Unblock User</button>}
                      {!isDeleting ? <button onClick={()=>setDeleteConfirmId(u.id)} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)] text-[#ff8a94] flex items-center gap-1"><Trash2 size={13}/> Delete User</button> : <span className="flex gap-2 items-center"><span className="text-xs font-bold text-[#ffb3ba]">Delete this user?</span><button disabled={busy} onClick={()=>deleteUser(u)} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#ff5d6c] text-[#03110a]">Yes, Delete</button><button onClick={()=>setDeleteConfirmId("")} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)]">Cancel</button></span>}
                    </div>
                  </div>;
                })}</div>}
              </div>
            </div>
          </div>}

          {adminTab==="tickets" && <div className="mt-4">
            <div className="flex items-end justify-between gap-3 flex-wrap"><div><h3 className="font-display font-bold text-xl">Support Tickets</h3><p className="text-sm text-[var(--muted)] mt-1">{tickets.length} tickets • {openTicketsCount} open / replied</p></div><button onClick={reloadAll} className="chip flex items-center gap-1"><RefreshCw size={13}/> Refresh</button></div>
            <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">{(["All","Open","Replied","Closed"] as const).map(f=><button key={f} onClick={()=>setTicketFilter(f)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${ticketFilter===f?"grad":"bg-[#0e1a14] border border-[var(--line)]"}`}>{f}</button>)}</div>
            {filteredAdminTickets.length===0 ? <div className="glass rounded-[22px] p-8 text-center mt-4"><LifeBuoy className="mx-auto text-[var(--muted)]" size={36}/><h4 className="font-bold mt-3">No tickets here</h4><p className="text-sm text-[var(--muted)] mt-1">When a user creates a ticket, it will appear here.</p></div>
            : <div className="space-y-3 mt-4">{filteredAdminTickets.map(t=>{
              const expanded = adminOpenTicketId===t.id;
              return <div key={t.id} className="glass rounded-2xl p-4 sm:p-5">
                <div className="flex justify-between gap-3 flex-wrap items-start"><div className="min-w-0"><p className="font-bold">{t.value.subject}</p><p className="text-xs text-[var(--muted)] mt-0.5 break-all">@{t.value.username} • {t.value.email} • {new Date(t.value.createdAt).toLocaleString()}</p><p className="text-sm mt-2 leading-relaxed break-words">{t.value.message}</p></div><span className={`chip h-fit flex items-center gap-1 shrink-0 ${ticketStatusChip(t.value.status)}`}>{t.value.status}</span></div>
                {(t.value.replies||[]).length>0 && <div className="mt-3 space-y-2">{t.value.replies.map((r,i)=><div key={i} className={`rounded-xl px-3 py-2.5 text-sm ${r.sender==="admin"?"bg-[#0f2a1e] border border-[#1f4a35]":"bg-[#08110e] border border-[var(--line)]"}`}><p className="text-[11px] font-bold text-[var(--muted)]">{r.sender==="admin" ? "ADMIN" : `@${t.value.username}`} • {new Date(r.at).toLocaleString()}</p><p className="mt-1 break-words">{r.text}</p></div>)}</div>}
                <div className="flex gap-2 mt-3 flex-wrap"><button onClick={()=>{ setAdminOpenTicketId(expanded?"":t.id); setAdminReplyText(""); }} className="px-4 py-2 rounded-lg text-xs font-bold grad">{expanded?"Hide Reply":"Reply"}</button><button onClick={()=>setTicketStatus(t,"Closed")} disabled={t.value.status==="Closed"} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)] disabled:opacity-50">Close Ticket</button><button onClick={()=>setTicketStatus(t,"Open")} disabled={t.value.status==="Open"} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)] disabled:opacity-50">Mark Open</button></div>
                {expanded && <div className="mt-3 flex gap-2"><input className="input" value={adminReplyText} onChange={e=>setAdminReplyText(e.target.value)} placeholder="Write your reply to this user..."/><button disabled={busy || !adminReplyText.trim()} onClick={()=>replyToTicketAsAdmin(t)} className="grad rounded-xl px-4 font-bold text-sm shrink-0 flex items-center gap-1"><Send size={15}/> Send</button></div>}
              </div>;
            })}</div>}
          </div>}

          {adminTab==="notifications" && <div className="grid lg:grid-cols-[380px_1fr] gap-4 mt-4 items-start">
            <form onSubmit={sendAdminNotification} className="glass rounded-[22px] p-5 space-y-3">
              <h2 className="font-display font-bold text-xl">Send Notification</h2>
              <div><label className="label">Send To</label><select className="input mt-1.5" value={notifTarget} onChange={e=>setNotifTarget(e.target.value)}><option value="all">All Users</option>{users.map(u=><option key={u.id} value={u.id}>{u.value.name} (@{u.value.username}) — {u.value.email || "No email"}</option>)}</select></div>
              <div><label className="label">Title</label><input className="input mt-1.5" value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="e.g. New Service Added"/></div>
              <div><label className="label">Message</label><textarea className="input mt-1.5" rows={4} value={notifMessage} onChange={e=>setNotifMessage(e.target.value)} placeholder="Write the message users will see..."/></div>
              {notifMsg && <p className="text-sm text-[#bfffd9] bg-[#0f2a1e] border border-[#1f4a35] rounded-xl px-3 py-2">{notifMsg}</p>}
              <button disabled={busy} className="grad w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Bell size={16}/> Send Notification</button>
              <p className="text-xs text-[var(--muted)]">Order, deposit, ticket, and balance updates are also sent automatically.</p>
            </form>
            <div>
              <h3 className="font-display font-bold text-lg mb-3">Sent Notifications ({notifications.length})</h3>
              {notifications.length===0 ? <div className="glass rounded-[22px] p-8 text-center"><Bell className="mx-auto text-[var(--muted)]"/><h4 className="font-bold mt-3">No notifications yet</h4><p className="text-sm text-[var(--muted)] mt-1">Send the first notification with the form.</p></div>
              : <div className="space-y-3">{[...notifications].sort((a,b)=>b.value.createdAt.localeCompare(a.value.createdAt)).map(n=><div key={n.id} className="glass rounded-2xl p-4"><div className="flex justify-between gap-2 flex-wrap"><p className="font-bold">{n.value.title}</p><span className="chip !py-1 !px-2.5 !text-[11px]">{n.value.userId==="all" ? "All Users" : `@${users.find(u=>u.id===n.value.userId)?.value.username || "User"}`}</span></div><p className="text-sm text-[var(--muted)] mt-1 break-words">{n.value.message}</p><p className="text-[11px] text-[var(--muted)] mt-2">{new Date(n.value.createdAt).toLocaleString()} • Read by {(n.value.readBy||[]).length} user{(n.value.readBy||[]).length===1?"":"s"}</p></div>)}</div>}
            </div>
          </div>}

          {adminTab==="coupons" && <div className="grid lg:grid-cols-[380px_1fr] gap-4 mt-4 items-start">
            <form onSubmit={addCoupon} className="glass rounded-[22px] p-5 space-y-3">
              <h2 className="font-display font-bold text-xl">Create Coupon</h2>
              <p className="text-sm text-[var(--muted)]">Users apply the code on the New Order page. Discount is taken off the order price.</p>
              <div><label className="label">Coupon Code</label><input className="input mt-1.5 uppercase" value={cCode} onChange={e=>setCCode(e.target.value.toUpperCase())} placeholder="e.g. SAVE10"/></div>
              <div><label className="label">Discount %</label><input type="number" min="1" max="100" className="input mt-1.5" value={cDiscount} onChange={e=>setCDiscount(e.target.value)} placeholder="10"/></div>
              <div><label className="label">Expiry (Optional)</label><input type="date" className="input mt-1.5" value={cExpiry} onChange={e=>setCExpiry(e.target.value)} /></div>
              <button disabled={busy} className="grad w-full py-3 rounded-xl font-bold flex items-center justify-center gap-1.5"><Tag size={16}/> Create Coupon</button>
            </form>
            <div>
              <h3 className="font-display font-bold text-lg mb-3">Coupons ({coupons.length})</h3>
              {coupons.length===0 ? <div className="glass rounded-[22px] p-8 text-center"><Tag className="mx-auto text-[var(--muted)]"/><h4 className="font-bold mt-3">No coupons yet</h4><p className="text-sm text-[var(--muted)] mt-1">Create the first coupon with the form.</p></div>
              : <div className="space-y-3">{[...coupons].sort((a,b)=>b.value.createdAt.localeCompare(a.value.createdAt)).map(c=><div key={c.id} className="glass rounded-2xl p-4 flex justify-between gap-3 flex-wrap items-center"><div><p className="font-display font-bold text-lg tracking-wide">{c.value.code}</p><p className="text-sm text-[var(--muted)]">{c.value.discountPercent}% off • {c.value.expiry ? `Expires ${c.value.expiry}` : "No expiry"}</p></div><div className="flex items-center gap-2"><span className={`chip ${c.value.active ? "!text-[#7dffb8] !border-[#1f4a35] !bg-[#0f2a1e]" : "!text-[#ff8a94] !border-[#4a1a20] !bg-[#2a1013]"}`}>{c.value.active ? "Active" : "Disabled"}</span><button onClick={()=>toggleCoupon(c)} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)]">{c.value.active ? "Disable" : "Enable"}</button><button onClick={()=>deleteCoupon(c.id)} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94] flex items-center gap-1"><Trash2 size={13}/> Delete</button></div></div>)}</div>}
            </div>
          </div>}

          {adminTab==="announcements" && <div className="grid lg:grid-cols-[380px_1fr] gap-4 mt-4 items-start">
            <form onSubmit={addAnnouncement} className="glass rounded-[22px] p-5 space-y-3">
              <h2 className="font-display font-bold text-xl">Create Announcement</h2>
              <p className="text-sm text-[var(--muted)]">Enabled announcements show as a banner on top of the user dashboard.</p>
              <div><label className="label">Title</label><input className="input mt-1.5" value={aTitle} onChange={e=>setATitle(e.target.value)} placeholder="e.g. New services added"/></div>
              <div><label className="label">Message</label><textarea className="input mt-1.5" rows={4} value={aMessage} onChange={e=>setAMessage(e.target.value)} placeholder="Write what users should see..."/></div>
              <button disabled={busy} className="grad w-full py-3 rounded-xl font-bold flex items-center justify-center gap-1.5"><Megaphone size={16}/> Create Announcement</button>
            </form>
            <div>
              <h3 className="font-display font-bold text-lg mb-3">Announcements ({announcements.length})</h3>
              {announcements.length===0 ? <div className="glass rounded-[22px] p-8 text-center"><Megaphone className="mx-auto text-[var(--muted)]"/><h4 className="font-bold mt-3">No announcements yet</h4><p className="text-sm text-[var(--muted)] mt-1">Create the first announcement with the form.</p></div>
              : <div className="space-y-3">{[...announcements].sort((a,b)=>b.value.createdAt.localeCompare(a.value.createdAt)).map(a=><div key={a.id} className="glass rounded-2xl p-4"><div className="flex justify-between gap-3 flex-wrap"><div className="min-w-0"><p className="font-bold">{a.value.title}</p><p className="text-sm text-[var(--muted)] mt-1 break-words">{a.value.message}</p><p className="text-[11px] text-[var(--muted)] mt-2">{new Date(a.value.createdAt).toLocaleString()}</p></div><span className={`chip h-fit ${a.value.enabled ? "!text-[#7dffb8] !border-[#1f4a35] !bg-[#0f2a1e]" : "!text-[var(--muted)]"}`}>{a.value.enabled ? "Enabled" : "Disabled"}</span></div><div className="flex gap-2 mt-3"><button onClick={()=>toggleAnnouncement(a)} className="px-3 py-2 rounded-lg text-xs font-bold grad">{a.value.enabled ? "Disable" : "Enable"}</button><button onClick={()=>deleteAnnouncement(a.id)} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94] flex items-center gap-1"><Trash2 size={13}/> Delete</button></div></div>)}</div>}
            </div>
          </div>}

          {adminTab==="activity" && <div className="mt-4">
            <div className="flex items-end justify-between gap-3 flex-wrap"><div><h3 className="font-display font-bold text-xl">Activity Log</h3><p className="text-sm text-[var(--muted)] mt-1">Last 50 actions across the panel.</p></div><button onClick={reloadAll} className="chip flex items-center gap-1"><RefreshCw size={13}/> Refresh</button></div>
            {activity.length===0 ? <div className="glass rounded-[22px] p-8 text-center mt-4"><Activity className="mx-auto text-[var(--muted)]" size={36}/><h4 className="font-bold mt-3">No activity yet</h4><p className="text-sm text-[var(--muted)] mt-1">Orders, deposits, tickets, and admin actions will appear here.</p></div>
            : <div className="space-y-2 mt-4">{[...activity].sort((a,b)=>b.value.createdAt.localeCompare(a.value.createdAt)).slice(0,50).map(a=><div key={a.id} className="glass rounded-2xl p-4 flex justify-between gap-3 flex-wrap"><p className="text-sm break-words min-w-0">{a.value.text}</p><span className="text-[11px] text-[var(--muted)] shrink-0">{new Date(a.value.createdAt).toLocaleString()}</span></div>)}</div>}
          </div>}

          {adminTab==="settings" && <div className="mt-4 max-w-[640px]">
            <h3 className="font-display font-bold text-xl">Panel Settings</h3><p className="text-sm text-[var(--muted)] mt-1">Saved in the panel and reflected in the UI right away.</p>
            <form onSubmit={saveSettings} className="glass rounded-[22px] p-5 mt-4 space-y-4">
              <div><label className="label">Panel Name</label><input className="input mt-1.5" value={setPanelName} onChange={e=>setSetPanelName(e.target.value)} placeholder="ZARORAT"/><p className="text-xs text-[var(--muted)] mt-1.5">Shown in headers and on the login screen.</p></div>
              <div><label className="label">Minimum Deposit (Rs)</label><input type="number" min="0" className="input mt-1.5" value={setMinDeposit} onChange={e=>setSetMinDeposit(e.target.value)} placeholder="50"/><p className="text-xs text-[var(--muted)] mt-1.5">Users cannot submit a deposit below this amount. Current: Rs {minDeposit}.</p></div>
              <div><label className="label">Referral Bonus (%)</label><input type="number" min="0" max="100" className="input mt-1.5" value={setReferralBonus} onChange={e=>setSetReferralBonus(e.target.value)} placeholder="5"/><p className="text-xs text-[var(--muted)] mt-1.5">Referrers earn this % of each referred user&apos;s order as bonus. Current: {referralBonusPercent}%.</p></div>
              <div><label className="label">Support Message</label><textarea className="input mt-1.5" rows={3} value={setSupportMsg} onChange={e=>setSetSupportMsg(e.target.value)} placeholder="How should users reach support?"/></div>
              <button disabled={busy} className="grad w-full py-3 rounded-xl font-bold flex items-center justify-center gap-1.5"><SettingsIcon size={16}/> Save Settings</button>
              <div className="rounded-xl bg-[#08110e] border border-[var(--line)] p-3 text-sm"><p className="font-bold">Preview</p><p className="text-[var(--muted)] mt-1">Panel: <b className="text-white">{setPanelName || "ZARORAT"}</b> • Min deposit: <b className="text-white">Rs {setMinDeposit || "0"}</b> • Referral bonus: <b className="text-white">{setReferralBonus || "0"}%</b></p><p className="text-[var(--muted)] mt-1 break-words">{setSupportMsg}</p></div>
            </form>
          </div>}
        </div>
      </div>
    );
  }

  const bal = currentUser?.value.balance || 0;
  return (
    <div style={{minHeight:"100vh"}} className="overflow-x-clip">
      <div className="mx-auto max-w-[430px] px-4 pb-32">
        <header data-safe-area-sticky-top style={{top:"var(--safe-area-inset-top)"}} className="sticky z-20 -mx-4 px-4 py-3 bg-[#050b09]/90 backdrop-blur border-b border-[var(--line)]">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl grad flex items-center justify-center font-display font-bold">Z</div><div><p className="font-display font-bold leading-none">{panelName} <span className="text-[var(--green)]">PANEL</span></p><p className="text-[11px] text-[var(--muted)]">Hello, {currentUser?.value.name} 👋 • {live==="synced" ? <span className="text-[#7dffb8]">● Live - Synced</span> : live==="connecting" ? "● Connecting…" : "● Offline — retrying"}</p></div></div><div className="flex items-center gap-2"><button onClick={()=>setTab("notifications")} aria-label="Notifications" className="relative w-10 h-10 rounded-xl bg-[#0e1a14] border border-[var(--line)] flex items-center justify-center"><Bell size={19}/>{unreadCount>0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#ff5d6c] text-white text-[11px] font-bold flex items-center justify-center">{unreadCount}</span>}</button><button onClick={logout} className="chip flex items-center gap-1"><LogOut size={13}/> Logout</button></div></div>
        </header>

        {isBlocked && <p className="mt-3 text-sm text-[#ffb3ba] bg-[#2a1013] border border-[#4a1a20] rounded-xl px-3 py-2.5 font-bold">Your account is blocked. Contact support.</p>}
        {dataError && <p className="mt-3 text-sm text-[#ffb3ba] bg-[#2a1013] border border-[#4a1a20] rounded-xl px-3 py-2">{dataError} <button onClick={reloadAll} className="underline font-bold">Retry</button></p>}
        {notice && <p className="mt-3 text-sm text-[#bfffd9] bg-[#0f2a1e] border border-[#1f4a35] rounded-xl px-3 py-2">{notice}</p>}

        {tab==="home" && <>
          {activeAnnouncements.map(a=><div key={a.id} className="mt-3 rounded-2xl border border-[#2a3a1a] bg-[#141a08] p-4 flex gap-3"><Megaphone className="text-[var(--lime)] shrink-0" size={20}/><div className="min-w-0"><p className="font-bold text-sm">{a.value.title}</p><p className="text-sm text-[#e8f5c8] mt-0.5 break-words">{a.value.message}</p></div></div>)}
          <div className="rounded-[24px] grad p-5 mt-4 relative overflow-hidden"><p className="text-[11px] font-bold tracking-[0.18em] text-[#03301d]">FAST PROCESSING • SECURE APPROVAL</p><h1 className="font-display font-bold text-[28px] leading-[1.05] mt-2 text-[#03110a]">Place your order,<br/>processing starts fast.</h1><button onClick={()=>setTab("new")} className="mt-4 bg-[#03110a] text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5">New Order <ArrowRight size={15}/></button><div className="absolute -right-4 -bottom-6 text-[90px] opacity-20 font-display font-bold">Z</div></div>

          <div className="flex items-center justify-between mt-6 mb-3"><h2 className="font-display font-bold text-lg flex items-center gap-2"><BarChart3 size={18} className="text-[var(--green)]"/> My Analytics</h2><span className="chip flex items-center gap-1"><Crown size={13} style={{color:myLevel.color}}/> {myLevel.name}</span></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-[20px] p-4"><div className="flex items-center gap-1.5 text-[var(--muted)] text-xs font-bold"><Wallet size={14}/> MY BALANCE</div><p className="font-display font-bold text-[26px] mt-1">Rs {bal}</p><button onClick={()=>setTab("wallet")} className="text-xs font-bold text-[var(--green)]">View Wallet History →</button></div>
            <div className="glass rounded-[20px] p-4"><div className="flex items-center gap-1.5 text-[var(--muted)] text-xs font-bold"><ShoppingBag size={14}/> TOTAL ORDERS</div><p className="font-display font-bold text-[26px] mt-1">{myOrders.length}</p><p className="text-[11px] text-[var(--muted)]">{myThisMonth} this month</p></div>
            <div className="glass rounded-[20px] p-4"><div className="flex items-center gap-1.5 text-[var(--muted)] text-xs font-bold"><DollarSign size={14}/> TOTAL SPENT</div><p className="font-display font-bold text-[26px] mt-1">Rs {myTotalSpent}</p><p className="text-[11px] text-[var(--muted)]">{myLevel.next}</p></div>
            <div className="glass rounded-[20px] p-4"><div className="flex items-center gap-1.5 text-[var(--muted)] text-xs font-bold"><CheckCircle2 size={14}/> COMPLETED</div><p className="font-display font-bold text-[26px] mt-1">{myCompleted}</p><p className="text-[11px] text-[#ffd88a]">{myPending} pending</p></div>
          </div>
          <div className="glass rounded-[20px] p-4 mt-3"><p className="font-bold text-sm">Orders — Last 7 Days</p>{myOrders.length===0 ? <p className="text-xs text-[var(--muted)] mt-2">No orders yet. Your chart will appear here.</p> : <div className="mt-3"><div className="flex items-end gap-2 h-20">{analytics7.map((d,i)=><div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0"><span className="text-[10px] font-bold">{d.count}</span><div className="w-full rounded-t-md grad" style={{height:`${Math.max(8, d.count/maxDayCount*100)}%`, minHeight:6, opacity: i===6?1:0.55}}/><span className="text-[9px] text-[var(--muted)]">{d.label}</span></div>)}</div></div>}</div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button onClick={()=>setTab("favorites")} className="glass rounded-2xl p-4 text-left"><span className="flex items-center gap-1.5 font-bold text-sm"><Star size={16} className="text-[#ffc247]"/> Favorites</span><span className="text-xs text-[var(--muted)] block mt-1">{favoriteServices.length} saved service{favoriteServices.length===1?"":"s"}</span></button>
            <button onClick={()=>setTab("profile")} className="glass rounded-2xl p-4 text-left"><span className="flex items-center gap-1.5 font-bold text-sm"><Gift size={16} className="text-[#7dffb8]"/> Referrals</span><span className="text-xs text-[var(--muted)] block mt-1">{myReferrals.length} referral{myReferrals.length===1?"":"s"} • Rs {myReferralEarnings} earned</span></button>
          </div>

          <button onClick={()=>setTab("deposit")} className="mt-3 w-full rounded-[20px] p-4 flex items-center gap-3 text-left relative overflow-hidden border border-[#1f4a35] bg-gradient-to-r from-[#0f2a1e] via-[#0a1f14] to-[#071a2a]"><span className="w-11 h-11 rounded-2xl grad flex items-center justify-center shrink-0"><Banknote size={22}/></span><span className="min-w-0 flex-1"><span className="font-display font-bold block">Add Funds • Easypaisa</span><span className="text-xs text-[var(--muted)]">Deposit to 03493959558 — Mohammad Ajmal</span></span><ArrowRight size={18} className="shrink-0 text-[var(--green)]"/></button>
          <button onClick={()=>setTab("support")} className="mt-3 w-full rounded-2xl border border-[#1f4a35] bg-[#0a1f14] p-4 flex items-center gap-3 text-left"><span className="w-10 h-10 rounded-xl grad flex items-center justify-center shrink-0"><LifeBuoy size={20}/></span><span className="min-w-0 flex-1"><span className="font-bold text-sm block">Support / Tickets</span><span className="text-xs text-[var(--muted)]">{myTickets.length} ticket{myTickets.length===1?"":"s"} • Instant Support</span></span><ArrowRight size={18} className="shrink-0 text-[var(--green)]"/></button>
          <div className="flex items-center justify-between mt-6 mb-3"><h2 className="font-display font-bold text-lg">Services</h2><span className="chip">{services.length} available</span></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">{cats.map(c=><button key={c} onClick={()=>setCatFilter(c)} className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap ${catFilter===c?"grad":"bg-[#0e1a14] border border-[var(--line)]"}`}>{c}</button>)}</div>
          <div className="flex gap-2 mt-3"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17}/><input className="input !pl-10" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services..."/></div><select aria-label="Sort services" className="input !w-[150px] shrink-0 !px-2 text-sm" value={sortBy} onChange={e=>setSortBy(e.target.value as any)}><option value="featured">Featured</option><option value="low">Price: Low → High</option><option value="high">Price: High → Low</option><option value="popular">Most Popular</option></select></div>
          {visibleServices.length===0 ? <div className="glass rounded-[22px] p-7 text-center mt-4"><div className="w-14 h-14 mx-auto rounded-2xl bg-[#0e1a14] flex items-center justify-center text-2xl">🛍️</div><h3 className="font-bold mt-3">No services available yet</h3><p className="text-sm text-[var(--muted)] mt-1 leading-relaxed">Please contact admin to add a service. As soon as a service is added, it will be listed here.</p><button onClick={()=>setTab("support")} className="inline-flex items-center gap-1.5 mt-4 bg-[#0e1a14] border border-[var(--line)] px-4 py-2.5 rounded-xl text-sm font-bold"><Phone size={14}/> Contact Support</button></div>
          : <div className="space-y-3 mt-4">{visibleServices.map(s=>renderServiceCard(s))}</div>}
          <div className="mt-4 rounded-2xl border border-[#2a3a1a] bg-[#141a08] p-4 flex gap-3"><Lock className="text-[var(--lime)] shrink-0" size={18}/><p className="text-sm leading-relaxed text-[#e8f5c8]"><b>Fast Processing:</b> Orders are processed with fast &amp; secure processing. Instant Support available.</p></div>
        </>}

        {tab==="favorites" && <div className="mt-4">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[var(--green)]">SAVED SERVICES</p><h2 className="font-display font-bold text-[26px] mt-1">Favorites</h2><p className="text-sm text-[var(--muted)] mt-1">Tap the star on any service to save it here for quick ordering.</p>
          {favoriteServices.length===0 ? <div className="glass rounded-[22px] p-8 text-center mt-4"><Star className="mx-auto text-[var(--muted)]" size={36}/><h3 className="font-bold mt-3">No favorites yet</h3><p className="text-sm text-[var(--muted)] mt-1">Star a service from Home to see it here.</p><button onClick={()=>setTab("home")} className="grad mt-4 px-5 py-2.5 rounded-xl text-sm font-bold">Browse Services</button></div>
          : <div className="space-y-3 mt-4">{favoriteServices.map(s=>renderServiceCard(s))}</div>}
        </div>}

        {tab==="wallet" && <div className="mt-4">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[var(--green)]">WALLET HISTORY</p><h2 className="font-display font-bold text-[26px] mt-1">Transaction History</h2><p className="text-sm text-[var(--muted)] mt-1">Deposits, order payments, refunds, coupon savings, referral bonuses and admin balance changes.</p>
          <div className="grid grid-cols-3 gap-2.5 mt-4"><div className="glass rounded-2xl p-3 text-center"><p className="text-[11px] font-bold text-[var(--muted)]">BALANCE</p><p className="font-display font-bold text-lg mt-1">Rs {bal}</p></div><div className="glass rounded-2xl p-3 text-center"><p className="text-[11px] font-bold text-[var(--muted)]">SPENT</p><p className="font-display font-bold text-lg mt-1">Rs {myTotalSpent}</p></div><div className="glass rounded-2xl p-3 text-center"><p className="text-[11px] font-bold text-[var(--muted)]">REFERRAL</p><p className="font-display font-bold text-lg mt-1 text-[#7dffb8]">+ Rs {myReferralEarnings}</p></div></div>
          {walletHistory.length===0 ? <div className="glass rounded-[22px] p-8 text-center mt-4"><History className="mx-auto text-[var(--muted)]" size={36}/><h3 className="font-bold mt-3">No transactions yet</h3><p className="text-sm text-[var(--muted)] mt-1">Your deposits, orders, refunds and bonuses will appear here.</p></div>
          : <div className="space-y-3 mt-4">{walletHistory.map(r=><div key={r.id} className="glass rounded-2xl p-4 flex justify-between gap-3 items-center"><div className="min-w-0"><p className="font-bold text-sm break-words">{r.title}</p><p className="text-xs text-[var(--muted)] mt-0.5">{r.detail} • {new Date(r.date).toLocaleString()}</p></div><div className="text-right shrink-0"><p className={`font-display font-bold ${r.amount>=0?"text-[#7dffb8]":"text-white"}`}>{r.amount>=0?"+":""}Rs {r.amount}</p><span className="chip !py-0.5 !px-2 !text-[10px]">{r.status}</span></div></div>)}</div>}
        </div>}

        {tab==="notifications" && <div className="mt-4">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold tracking-[0.18em] text-[var(--green)]">NOTIFICATIONS</p><h2 className="font-display font-bold leading-none mt-2" style={{fontSize:"clamp(28px,9vw,36px)"}}>Notifications</h2><p className="text-sm text-[var(--muted)] mt-2">{unreadCount} unread • {myNotifications.length} total</p></div>{unreadCount>0 && <button disabled={busy} onClick={markAllNotificationsRead} className="chip shrink-0">Mark all as read</button>}</div>
          <div className="flex gap-2 mt-4"><button onClick={()=>setNotifFilter("all")} className={`px-4 py-2 rounded-full text-sm font-bold ${notifFilter==="all"?"grad":"bg-[#0e1a14] border border-[var(--line)]"}`}>All</button><button onClick={()=>setNotifFilter("unread")} className={`px-4 py-2 rounded-full text-sm font-bold ${notifFilter==="unread"?"grad":"bg-[#0e1a14] border border-[var(--line)]"}`}>Unread ({unreadCount})</button></div>
          {filteredNotifications.length===0 ? <div className="glass rounded-[22px] p-8 text-center mt-4"><Bell className="mx-auto text-[var(--muted)]" size={36}/><h3 className="font-bold mt-3">{notifFilter==="unread" ? "No unread notifications" : "No notifications yet"}</h3><p className="text-sm text-[var(--muted)] mt-1">Order, deposit, ticket, and admin updates will appear here.</p></div>
          : <div className="space-y-3 mt-4">{filteredNotifications.map(n=>{
            const isRead = (n.value.readBy||[]).includes(currentUser?.id || "");
            return <div key={n.id} className={`glass rounded-2xl p-4 ${isRead ? "opacity-75" : ""}`}><div className="flex justify-between gap-3 items-start"><div className="min-w-0"><p className="font-bold flex items-center gap-2">{n.value.title}{!isRead && <span className="w-2 h-2 rounded-full bg-[#00e676] shrink-0"/>}</p><p className="text-sm text-[var(--muted)] mt-1 leading-relaxed break-words">{n.value.message}</p><p className="text-[11px] text-[var(--muted)] mt-2">{new Date(n.value.createdAt).toLocaleString()}</p></div>{!isRead && <button onClick={()=>markNotificationRead(n)} className="chip shrink-0 !py-1.5">Mark as Read</button>}</div></div>;
          })}</div>}
        </div>}

        {tab==="support" && <div className="mt-4">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[var(--green)]">SUPPORT • TICKETS</p><h2 className="font-display font-bold text-[26px] mt-1">Support / Tickets</h2><p className="text-sm text-[var(--muted)] mt-1">{supportMessage}</p><p className="text-sm text-[var(--muted)] mt-1">Contact is via Tickets only. Instant Support.</p>
          <form onSubmit={createTicket} className="glass rounded-[22px] p-5 mt-4 space-y-4">
            <h3 className="font-display font-bold text-lg">Create Ticket</h3>
            <div><label className="label">Subject</label><input className="input mt-1.5" value={ticketSubject} onChange={e=>setTicketSubject(e.target.value)} placeholder="e.g. My order is still pending"/></div>
            <div><label className="label">Message</label><textarea className="input mt-1.5" rows={4} value={ticketMessage} onChange={e=>setTicketMessage(e.target.value)} placeholder="Write your problem in detail..."/></div>
            {ticketMsg && <p className={`text-sm rounded-xl px-3 py-2 border ${ticketMsg.includes("created")?"text-[#bfffd9] bg-[#0f2a1e] border-[#1f4a35]":"text-[#ffb3ba] bg-[#2a1013] border-[#4a1a20]"}`}>{ticketMsg}</p>}
            <button disabled={busy} className="grad w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2"><LifeBuoy size={17}/> Create Ticket</button>
          </form>
          <div className="flex items-center justify-between mt-6 mb-3"><h3 className="font-display font-bold text-lg">My Tickets</h3><span className="chip">{myTickets.length} tickets</span></div>
          {myTickets.length===0 ? <div className="glass rounded-[22px] p-8 text-center"><LifeBuoy className="mx-auto text-[var(--muted)]" size={36}/><h3 className="font-bold mt-3">No tickets yet</h3><p className="text-sm text-[var(--muted)] mt-1">Create your first ticket above.</p></div>
          : <div className="space-y-3">{myTickets.map(t=>{
            const expanded = openTicketId===t.id;
            return <div key={t.id} className="glass rounded-2xl p-4">
              <div className="flex justify-between gap-2 items-start"><div className="min-w-0"><p className="font-bold break-words">{t.value.subject}</p><p className="text-[11px] text-[var(--muted)] mt-1">{new Date(t.value.createdAt).toLocaleString()}</p><p className="text-sm text-[var(--muted)] mt-2 break-words">{t.value.message}</p></div><span className={`chip h-fit flex items-center gap-1 shrink-0 ${ticketStatusChip(t.value.status)}`}>{t.value.status}</span></div>
              {(t.value.replies||[]).length>0 && <div className="mt-3 space-y-2">{t.value.replies.map((r,i)=><div key={i} className={`rounded-xl px-3 py-2.5 text-sm ${r.sender==="admin"?"bg-[#0f2a1e] border border-[#1f4a35]":"bg-[#08110e] border border-[var(--line)]"}`}><p className="text-[11px] font-bold text-[var(--muted)]">{r.sender==="admin" ? "ADMIN" : "YOU"} • {new Date(r.at).toLocaleString()}</p><p className="mt-1 break-words">{r.text}</p></div>)}</div>}
              <button onClick={()=>{ setOpenTicketId(expanded?"":t.id); setUserReplyText(""); }} className="mt-3 px-4 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)]">{expanded?"Hide Reply":"Reply in Ticket"}</button>
              {expanded && <div className="mt-3 flex gap-2"><input className="input" value={userReplyText} onChange={e=>setUserReplyText(e.target.value)} placeholder="Write your reply..."/><button disabled={busy || !userReplyText.trim()} onClick={()=>replyToTicketAsUser(t)} className="grad rounded-xl px-4 font-bold text-sm shrink-0 flex items-center gap-1"><Send size={15}/> Send</button></div>}
            </div>;
          })}</div>}
        </div>}

        {tab==="deposit" && <div className="mt-4">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold tracking-[0.18em] text-[var(--green)]">ADD FUNDS • SECURE APPROVAL</p><h2 className="font-display font-bold leading-none mt-2" style={{fontSize:"clamp(30px,9vw,38px)"}}>Deposit</h2></div><button onClick={reloadAll} className="chip flex items-center gap-1 shrink-0"><RefreshCw size={13}/> Refresh</button></div>

          <div className="rounded-[26px] p-4 mt-4 bg-gradient-to-br from-[#7dffb8] via-[#00e676] to-[#00c2a8] text-[#03110a] relative overflow-hidden">
            <div className="flex items-center justify-between gap-3"><span className="bg-[#03110a] text-white text-[11px] font-bold tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5"><Landmark size={13}/> EASYPAISA</span><span className="text-[11px] font-bold bg-white/25 px-2.5 py-1 rounded-full">SECURE • VERIFIED</span></div>
            <p className="text-[11px] font-bold tracking-[0.16em] mt-5 text-[#03301d]">SEND MONEY TO THIS ACCOUNT</p>
            <div className="flex items-end justify-between gap-2 mt-1 flex-wrap"><p className="font-display font-bold leading-none break-all" style={{fontSize:"clamp(30px,9vw,40px)"}}>03493959558</p><span className="w-12 h-12 rounded-2xl bg-[#03110a] text-white flex items-center justify-center shrink-0 text-xl font-display font-bold">₨</span></div>
            <div className="mt-4 bg-[#03110a]/90 text-white rounded-2xl p-3.5 flex items-center justify-between gap-3 flex-wrap"><div className="min-w-0"><p className="text-[11px] text-[#9db5ab] font-bold tracking-widest">ACCOUNT NAME</p><p className="font-display font-bold text-lg leading-tight truncate">Mohammad Ajmal</p></div><span className="text-[11px] font-bold bg-[#0f2a1e] border border-[#1f4a35] text-[#7dffb8] px-2.5 py-1.5 rounded-full">EASYPAISA</span></div>
            <input ref={copyInputRef} readOnly value="03493959558" aria-label="Easypaisa account number" className="absolute opacity-0 pointer-events-none h-1 w-1" tabIndex={-1} />
            <button onClick={copyNumber} className="mt-3 w-full bg-[#03110a] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2">{copied ? <><Check size={18} className="text-[#00e676]"/> Number Copied!</> : <><Copy size={17}/> Copy Number</>}</button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-3">
            <div className="glass rounded-2xl p-3 text-center"><p className="text-[11px] font-bold text-[var(--muted)]">YOUR BALANCE</p><p className="font-display font-bold text-xl mt-1">Rs {bal}</p></div>
            <div className="glass rounded-2xl p-3 text-center"><p className="text-[11px] font-bold text-[var(--muted)]">DEPOSITS</p><p className="font-display font-bold text-xl mt-1">{myDeposits.length}</p></div>
            <div className="glass rounded-2xl p-3 text-center"><p className="text-[11px] font-bold text-[var(--muted)]">PENDING</p><p className="font-display font-bold text-xl mt-1 text-[#ffd88a]">{myDeposits.filter(d=>d.value.status==="Pending").length}</p></div>
          </div>

          <div className="glass rounded-[22px] p-5 mt-3 space-y-4">
            <h3 className="font-display font-bold text-lg">How to Deposit</h3>
            {[{n:"1",t:"Send money to the Easypaisa number above",d:"Open Easypaisa and send your amount to 03493959558 — Mohammad Ajmal."},{n:"2",t:"Enter Amount + Transaction ID (TID) below",d:"After payment, copy the TID from your Easypaisa receipt / SMS."},{n:"3",t:"Submit — Admin will approve and add balance",d:"Your request stays Pending until the admin checks it and adds your balance."}].map(s=><div key={s.n} className="flex gap-3"><span className="w-8 h-8 rounded-full grad flex items-center justify-center font-display font-bold shrink-0">{s.n}</span><div className="min-w-0"><p className="font-bold text-sm leading-snug">{s.t}</p><p className="text-sm text-[var(--muted)] leading-relaxed mt-0.5">{s.d}</p></div></div>)}
          </div>

          <form onSubmit={submitDeposit} className="glass rounded-[22px] p-5 mt-3 space-y-4">
            <h3 className="font-display font-bold text-lg">Deposit Form</h3>
            <div><label className="label">Amount (Rs) * — Minimum Rs {minDeposit}</label><input type="number" min={minDeposit} className="input mt-1.5 !py-4 !text-lg font-bold" value={depAmount} onChange={e=>setDepAmount(e.target.value)} placeholder={`e.g. ${Math.max(minDeposit,500)}`} /></div>
            <div><label className="label">Transaction ID (TID) *</label><input className="input mt-1.5" value={depTid} onChange={e=>setDepTid(e.target.value)} placeholder="e.g. 1234567890" /></div>
            <div><label className="label">Note (Optional)</label><input className="input mt-1.5" value={depNote} onChange={e=>setDepNote(e.target.value)} placeholder="e.g. Sent from Easypaisa app" /><p className="text-xs text-[var(--muted)] mt-1.5">Photo uploads are not available yet — add a short note if you want.</p></div>
            {depMsg && <p className={`text-sm rounded-xl px-3 py-2.5 border ${depMsg.includes("submitted")?"text-[#bfffd9] bg-[#0f2a1e] border-[#1f4a35]":"text-[#ffb3ba] bg-[#2a1013] border-[#4a1a20]"}`}>{depMsg}</p>}
            <button disabled={busy} className="grad w-full py-4 rounded-2xl font-display font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"><Banknote size={19}/>{busy?"Submitting...":"Submit Deposit Request"}</button>
            <p className="text-center text-xs text-[var(--muted)]">Balance is added only after admin approval.</p>
          </form>

          <div className="flex items-center justify-between mt-6 mb-3"><h3 className="font-display font-bold text-lg">Deposit History</h3><span className="chip">{myDeposits.length} deposits</span></div>
          {myDeposits.length===0 ? <div className="glass rounded-[22px] p-7 text-center"><Banknote className="mx-auto text-[var(--muted)]" size={36}/><h4 className="font-bold mt-3">No deposits yet</h4><p className="text-sm text-[var(--muted)] mt-1 leading-relaxed">You have not submitted any deposit request yet. Send money on Easypaisa, then submit the form above.</p></div>
          : <div className="space-y-3">{myDeposits.map(d=><div key={d.id} className="glass rounded-2xl p-4"><div className="flex justify-between gap-3 items-start"><div className="min-w-0"><p className="font-display font-bold text-2xl">Rs {d.value.amount}</p><p className="text-xs text-[var(--muted)] mt-1 break-all">TID: <b className="text-white">{d.value.tid}</b></p>{d.value.note && <p className="text-sm text-[var(--muted)] mt-1 break-words">{d.value.note}</p>}<p className="text-[11px] text-[var(--muted)] mt-2">{new Date(d.value.createdAt).toLocaleString()}</p></div><span className={`chip h-fit flex items-center gap-1 shrink-0 ${depositStatusChip(d.value.status)}`}>{d.value.status==="Approved"?<CheckCircle2 size={13}/>:d.value.status==="Rejected"?<XCircle size={13}/>:<Clock3 size={13}/>}{d.value.status}</span></div></div>)}</div>}
        </div>}

        {tab==="new" && <div className="mt-4">
          <h2 className="font-display font-bold text-[26px]">New Order</h2><p className="text-sm text-[var(--muted)] mt-1">Enter the service, link, and quantity. Balance: <b className="text-white">Rs {bal}</b></p>
          <form onSubmit={placeOrder} className="glass rounded-[22px] p-5 mt-4 space-y-4">
            <div><label className="label">Select Service</label><select className="input mt-1.5" value={selService} onChange={e=>setSelService(e.target.value)}><option value="">— Choose a service —</option>{services.map(s=><option key={s.id} value={s.id}>{s.value.name} — Rs {s.value.pricePer1000}/1000</option>)}</select>{services.length===0 && <p className="text-sm text-[#ffb3ba] mt-2 bg-[#2a1013] border border-[#4a1a20] rounded-xl px-3 py-2">No service available. Ask the admin to add a service.</p>}</div>
            {selectedService && <div className="bg-[#0a1f14] border border-[#1f4a35] rounded-xl p-3 text-sm"><b>{selectedService.value.name}</b><span className="text-[var(--muted)]"> • Min {selectedService.value.min} • Max {selectedService.value.max} • Rs {selectedService.value.pricePer1000} / 1000</span></div>}
            <div><label className="label">Link</label><input className="input mt-1.5" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://instagram.com/..." /></div>
            <div><label className="label">Quantity</label><input type="number" className="input mt-1.5" value={qty} onChange={e=>setQty(e.target.value)} placeholder="e.g. 1000" /></div>
            <div><label className="label">Coupon Code (Optional)</label><div className="flex gap-2 mt-1.5"><input className="input uppercase" value={couponCode} onChange={e=>{ setCouponCode(e.target.value.toUpperCase()); setAppliedCoupon(null); setCouponMsg(""); }} placeholder="e.g. SAVE10"/><button type="button" onClick={applyCoupon} className="shrink-0 px-4 rounded-xl font-bold text-sm bg-[#0e1a14] border border-[var(--line)] flex items-center gap-1"><Tag size={15}/> Apply</button></div>{couponMsg && <p className={`text-sm rounded-xl px-3 py-2 border mt-2 ${couponMsg.includes("applied")?"text-[#bfffd9] bg-[#0f2a1e] border-[#1f4a35]":"text-[#ffb3ba] bg-[#2a1013] border-[#4a1a20]"}`}>{couponMsg}</p>}{appliedCoupon && <p className="text-xs text-[var(--muted)] mt-1.5">Coupon {appliedCoupon.value.code} — {appliedCoupon.value.discountPercent}% off applied.</p>}</div>
            {selectedService && qty && <div className="bg-[#08110e] border border-[var(--line)] rounded-xl px-4 py-3 text-sm space-y-1.5"><div className="flex justify-between"><span className="text-[var(--muted)]">Estimated Price</span><b>Rs {estPrice}</b></div>{appliedCoupon && <div className="flex justify-between"><span className="text-[var(--muted)]">Coupon Discount ({appliedCoupon.value.discountPercent}%)</span><b className="text-[#7dffb8]">− Rs {couponDiscountAmount}</b></div>}<div className="flex justify-between border-t border-[var(--line)] pt-1.5"><span className="text-[var(--muted)]">You Pay</span><b className="text-[var(--green)]">Rs {finalPrice}</b></div></div>}
            {orderMsg && <p className={`text-sm rounded-xl px-3 py-2 border ${orderMsg.includes("received")?"text-[#bfffd9] bg-[#0f2a1e] border-[#1f4a35]":"text-[#ffb3ba] bg-[#2a1013] border-[#4a1a20]"}`}>{orderMsg}</p>}
            <button disabled={busy || services.length===0} className="grad w-full py-3.5 rounded-xl font-bold disabled:opacity-50">{busy?"Sending Order...":"Place Order"}</button>
          </form>
          <button onClick={()=>setTab("support")} className="mt-3 w-full rounded-2xl border border-[#1f4a35] bg-[#0a1f14] p-4 flex items-center gap-3 text-left"><span className="w-10 h-10 rounded-xl bg-[#00e676] text-[#03110a] flex items-center justify-center shrink-0"><MessageCircle size={20}/></span><span><span className="font-bold text-sm block">Order Help via Support</span><span className="text-xs text-[var(--muted)]">Open a ticket and the admin will help →</span></span></button>
        </div>}

        {tab==="orders" && <div className="mt-4">
          <div className="flex items-end justify-between"><div><h2 className="font-display font-bold text-[26px]">My Orders</h2><p className="text-sm text-[var(--muted)] mt-1">Track all your orders here.</p></div><button onClick={reloadAll} className="chip flex items-center gap-1"><RefreshCw size={13}/> Refresh</button></div>
          {myOrders.length===0 ? <div className="glass rounded-[22px] p-8 text-center mt-4"><ClipboardList className="mx-auto text-[var(--muted)]" size={36}/><h3 className="font-bold mt-3">No orders yet</h3><p className="text-sm text-[var(--muted)] mt-1">You have not placed any order yet. Place your first order.</p><button onClick={()=>setTab("new")} className="grad mt-4 px-5 py-2.5 rounded-xl text-sm font-bold">Place a New Order</button></div>
          : <div className="space-y-3 mt-4">{myOrders.map(o=>{
            const tr = trackingFor(o.value.status);
            const open = trackingOpenId===o.id;
            return <div key={o.id} className="glass rounded-2xl p-4"><div className="flex justify-between gap-2"><div className="min-w-0"><p className="font-bold truncate">{o.value.serviceName}</p><p className="text-xs text-[var(--muted)] mt-0.5">Qty {o.value.quantity} • Rs {o.value.price}{o.value.couponCode ? ` • Coupon ${o.value.couponCode} (-Rs ${o.value.discountAmount||0})` : ""}</p></div><span className={`chip h-fit flex items-center gap-1 ${o.value.status==="Completed"?"!text-[#7dffb8]":o.value.status==="Cancelled"?"!text-[#ff8a94]":o.value.status==="Refunded"?"!text-[#c9a7ff]":"!text-[#ffd88a]"}`}>{o.value.status==="Completed"?<CheckCircle2 size={13}/>:o.value.status==="Cancelled"?<XCircle size={13}/>:o.value.status==="Refunded"?<RotateCcw size={13}/>:<Clock3 size={13}/>}{o.value.status}</span></div>
            <p className="text-sm text-[#7dc8ff] break-all mt-2">{o.value.link}</p>
            <div className="mt-3"><div className="flex justify-between text-[11px] font-bold"><span className="text-[var(--muted)]">ORDER TRACKING</span><span>{tr.label}</span></div><div className="h-2 rounded-full bg-[#08110e] mt-1.5 overflow-hidden"><div className={`h-full rounded-full ${o.value.status==="Cancelled"?"bg-[#ff5d6c]":o.value.status==="Refunded"?"bg-[#c9a7ff]":"grad"}`} style={{width:`${tr.progress}%`}}/></div><div className="flex justify-between mt-2">{tr.steps.map((st,idx)=><span key={st} className={`text-[10px] font-bold ${idx<=tr.active?"text-white":"text-[var(--muted)]"}`}>{idx<=tr.active?"● ":"○ "}{st}</span>)}</div></div>
            <p className="text-[11px] text-[var(--muted)] mt-2">{new Date(o.value.createdAt).toLocaleString()}</p>
            <div className="flex gap-2 mt-3 flex-wrap"><button onClick={()=>startReorder(o)} className="grad px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1"><Repeat size={13}/> Reorder</button><button onClick={()=>setTrackingOpenId(open?"":o.id)} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0e1a14] border border-[var(--line)]">{open?"Hide Details":"Tracking Details"}</button></div>
            {open && <div className="mt-3 bg-[#08110e] border border-[var(--line)] rounded-xl p-3 text-sm space-y-2">{tr.steps.map((st,idx)=><div key={st} className="flex gap-2 items-center"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${idx<=tr.active?"grad":"bg-[#0e1a14] border border-[var(--line)] text-[var(--muted)]"}`}>{idx<=tr.active?"✓":idx+1}</span><span className={idx<=tr.active?"font-bold":"text-[var(--muted)]"}>{st}{idx===0?" — Order received":idx===tr.steps.length-1?` — ${tr.label}`:" — In progress"}</span></div>)}<p className="text-xs text-[var(--muted)]">Placed on {new Date(o.value.createdAt).toLocaleString()} • Service: {o.value.serviceName}</p></div>}
            </div>;
          })}</div>}
        </div>}

        {tab==="profile" && <div className="mt-4">
          <h2 className="font-display font-bold text-[26px]">Profile</h2>
          <div className="glass rounded-[22px] p-5 mt-4 flex items-center gap-4"><div className="w-14 h-14 rounded-2xl grad flex items-center justify-center font-display font-bold text-2xl shrink-0">{currentUser?.value.name?.[0]?.toUpperCase()}</div><div className="min-w-0 flex-1"><p className="font-bold text-lg truncate">{currentUser?.value.name}</p><p className="text-sm text-[var(--muted)]">@{currentUser?.value.username}</p><p className="text-xs text-[var(--muted)] mt-1 break-all">{currentUser?.value.email}</p></div><button onClick={()=>{ setProfileName(currentUser?.value.name||""); setEditingProfile(!editingProfile); setProfileMsg(""); }} className="chip shrink-0 flex items-center gap-1"><Pencil size={13}/> Edit</button></div>
          {editingProfile && <div className="glass rounded-[22px] p-4 mt-3"><label className="label">Display Name</label><div className="flex gap-2 mt-1.5"><input className="input" value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Your display name"/><button disabled={busy} onClick={saveProfileName} className="grad rounded-xl px-4 font-bold text-sm shrink-0">Save</button></div>{profileMsg && <p className="text-sm text-[#bfffd9] mt-2">{profileMsg}</p>}</div>}
          <div className="glass rounded-[22px] p-5 mt-3"><div className="flex justify-between items-center gap-2 flex-wrap"><div className="flex items-center gap-2"><Crown size={20} style={{color:myLevel.color}}/><div><p className="font-bold">{myLevel.name} Level</p><p className="text-xs text-[var(--muted)]">{myLevel.next}</p></div></div><span className="chip">Total Spent Rs {myTotalSpent}</span></div><div className="h-2.5 rounded-full bg-[#08110e] mt-3 overflow-hidden"><div className="h-full grad rounded-full" style={{width:`${myLevel.progress}%`}}/></div><p className="text-xs text-[var(--muted)] mt-2">Levels: New (Rs 0) • Silver (Rs 1,000) • Gold (Rs 5,000) • VIP (Rs 20,000)</p></div>
          <div className="grid grid-cols-2 gap-3 mt-3"><div className="glass rounded-2xl p-4"><p className="text-xs text-[var(--muted)] font-bold">BALANCE</p><p className="font-display font-bold text-2xl mt-1">Rs {bal}</p></div><div className="glass rounded-2xl p-4"><p className="text-xs text-[var(--muted)] font-bold">ORDERS</p><p className="font-display font-bold text-2xl mt-1">{myOrders.length}</p></div><div className="glass rounded-2xl p-4"><p className="text-xs text-[var(--muted)] font-bold flex items-center gap-1"><CalendarDays size={12}/> MEMBER SINCE</p><p className="font-bold mt-1">{currentUser ? new Date(currentUser.value.createdAt).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}) : ""}</p></div><div className="glass rounded-2xl p-4"><p className="text-xs text-[var(--muted)] font-bold">ACCOUNT STATUS</p><p className="font-bold mt-1">{currentUser?.value.status || "Active"}</p></div></div>

          <div className="glass rounded-[22px] p-5 mt-3"><div className="flex items-center gap-2"><Gift size={18} className="text-[#7dffb8]"/><h3 className="font-display font-bold text-lg">My Referral</h3></div><p className="text-sm text-[var(--muted)] mt-1">Share your code. When someone signs up with it, you earn <b className="text-white">{referralBonusPercent}%</b> of their orders as bonus.</p>
            <div className="flex gap-2 mt-3"><div className="relative flex-1"><input ref={referralInputRef} readOnly value={myReferralCode} aria-label="Your referral code" className="input !pr-11 font-bold tracking-wide"/><button type="button" onClick={copyReferralCode} aria-label="Copy referral code" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]">{referralCopied?<Check size={17} className="text-[#00e676]"/>:<Copy size={17}/>}</button></div><button onClick={copyReferralCode} className="grad rounded-xl px-4 font-bold text-sm shrink-0">{referralCopied?"Copied!":"Copy Code"}</button></div>
            <div className="grid grid-cols-2 gap-2.5 mt-3"><div className="bg-[#08110e] border border-[var(--line)] rounded-xl p-3 text-center"><p className="text-[11px] font-bold text-[var(--muted)]">MY REFERRALS</p><p className="font-display font-bold text-xl mt-0.5">{myReferrals.length}</p></div><div className="bg-[#08110e] border border-[var(--line)] rounded-xl p-3 text-center"><p className="text-[11px] font-bold text-[var(--muted)]">TOTAL EARNINGS</p><p className="font-display font-bold text-xl mt-0.5 text-[#7dffb8]">Rs {myReferralEarnings}</p></div></div>
            {myReferrals.length>0 && <div className="mt-3 space-y-2">{myReferrals.map(r=><div key={r.id} className="flex justify-between gap-2 text-sm bg-[#08110e] border border-[var(--line)] rounded-xl px-3 py-2.5"><span className="font-bold truncate">{r.value.name} (@{r.value.username})</span><span className="text-[var(--muted)] shrink-0 text-xs mt-0.5">Joined {new Date(r.value.createdAt).toLocaleDateString()}</span></div>)}</div>}
          </div>

          <button onClick={()=>setTab("wallet")} className="mt-3 w-full rounded-2xl border border-[#1f4a35] bg-[#0a1f14] p-4 flex items-center gap-3 text-left"><History className="text-[var(--green)] shrink-0"/><span className="text-sm"><b>Wallet History</b><br/><span className="text-[var(--muted)] text-xs">Deposits, orders, refunds &amp; bonuses</span></span></button>
          <button onClick={()=>setTab("support")} className="mt-3 w-full rounded-2xl border border-[#1f4a35] bg-[#0a1f14] p-4 flex items-center gap-3 text-left"><LifeBuoy className="text-[var(--green)] shrink-0"/><span className="text-sm"><b>Support / Tickets</b><br/><span className="text-[var(--muted)] text-xs">Create a ticket and chat with admin</span></span></button>
          <button onClick={()=>setTab("deposit")} className="mt-3 w-full rounded-2xl border border-[#1f4a35] bg-[#0a1f14] p-4 flex items-center gap-3 text-left"><Banknote className="text-[var(--green)] shrink-0"/><span className="text-sm"><b>Add Funds with Easypaisa</b><br/><span className="text-[var(--muted)] text-xs">Deposit to 03493959558 — Mohammad Ajmal</span></span></button>
          <button onClick={()=>setTab("support")} className="mt-3 w-full rounded-2xl border border-[#1f4a35] bg-[#0a1f14] p-4 flex items-center gap-3 text-left"><MessageCircle className="text-[var(--green)] shrink-0"/><span className="text-sm"><b>Contact Admin for Balance</b><br/><span className="text-[var(--muted)] text-xs">Open a support ticket</span></span></button>
          <button onClick={logout} className="w-full mt-3 bg-[#2a1013] border border-[#4a1a20] text-[#ff8a94] py-3 rounded-xl font-bold">Logout</button>
          <p className="text-center text-xs text-[var(--muted)] mt-4">Fast Processing — Orders start within minutes with verified processing.</p>
        </div>}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--line)] bg-[#070f0c]/95 backdrop-blur px-2 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[430px] grid grid-cols-7">
          {([{k:"home",l:"Home",I:Home},{k:"deposit",l:"Deposit",I:Banknote},{k:"new",l:"New",I:Plus},{k:"orders",l:"Orders",I:ClipboardList},{k:"favorites",l:"Saved",I:Star},{k:"support",l:"Support",I:LifeBuoy},{k:"profile",l:"Profile",I:User}] as const).map(x=><button key={x.k} onClick={()=>setTab(x.k)} className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] sm:text-[11px] font-bold ${tab===x.k?"text-[var(--green)]":"text-[var(--muted)]"}`}><x.I size={21}/>{x.l}</button>)}
        </div>
      </nav>
    </div>
  );
}

export default function App(){
  return <div data-safe-area-inset-root style={{boxSizing: 'border-box', paddingTop: 'var(--safe-area-inset-top)', minHeight:"100vh", background:"var(--bg)"}}><Inner/></div>;
}
