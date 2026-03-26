"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GlassNotification from "@/components/GlassNotification";
// import { syncRequestToSheet } from "../actions"; // Import Server Action

export default function DashboardPage() {
  const [teamName, setTeamName] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notification, setNotification] = useState({ show: false, message: "", type: "info" as "success" | "error" | "info" });
  
  // Inventory State
  const [workerCount, setWorkerCount] = useState(0);
  const [holdings, setHoldings] = useState({ devices: 0, sdCards: 0 });

  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("role");
    const storedTeam = localStorage.getItem("teamName");
    
    if (!storedTeam || role === "admin") {
      router.push("/");
    } else {
      setTeamName(storedTeam);
      fetchRequests(storedTeam);

      // Load worker count
      const workers = localStorage.getItem(`workerCount_${storedTeam}`);
      if (workers) setWorkerCount(Number(workers));
    }
  }, [router]);

  useEffect(() => {
    if (requests.length > 0) {
      // Calculate holdings based on 'completed' (received) items
      const received = requests.filter(r => r.status === 'completed');
      const dev = received.reduce((sum, r) => sum + (r.device_qty || 0), 0);
      const sd = received.reduce((sum, r) => sum + (r.sd_card_qty || 0), 0);
      setHoldings({ devices: dev, sdCards: sd });
    }
  }, [requests]);

  const updateWorkerCount = (val: string) => {
    const num = Number(val);
    if (!isNaN(num) && num >= 0) {
      setWorkerCount(num);
      if (teamName) localStorage.setItem(`workerCount_${teamName}`, String(num));
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ show: true, message, type });
  };

  async function fetchRequests(team: string) {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("team", team)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    if (data) setRequests(data);
  }

  const handleNewRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const dQty = Number(formData.get("device_qty")) || 0;
    const sQty = Number(formData.get("sd_card_qty")) || 0;
    const cQty = Number(formData.get("charger_hub_qty")) || 0;

    if (dQty === 0 && sQty === 0 && cQty === 0) {
      showToast("Please request at least one item.", "error");
      return;
    }

    const newRequest = {
      team: teamName,
      factory_name: formData.get("factory_name"),
      person_name: formData.get("person_name"),
      phone_number: formData.get("phone_number"),
      city: formData.get("city"),
      state: formData.get("state"),
      location: formData.get("location"), // Full Address
      pincode: formData.get("pincode"),
      poc: formData.get("poc") || "",
      device_qty: dQty,
      sd_card_qty: sQty,
      charger_hub_qty: cQty,
      user_comment: formData.get("user_comment") || "",
      status: "sent",
      item: "Multiple items",
      quantity: dQty + sQty + cQty
    };

    const { error } = await supabase.from("requests").insert([newRequest]);
    
    if (!error) {
      // Google Sheet sync removed for now
      // await syncRequestToSheet(newRequest);
      
      fetchRequests(teamName);
      (e.target as HTMLFormElement).reset();
      showToast("Request submitted successfully!", "success");
    } else {
      console.error("Supabase Error: ", error);
      showToast("Error submitting request: " + error.message, "error");
    }
  };

  const handleMarkReceived = async (reqId: any) => {
    if (!confirm("Confirm you have received these items?")) return;

    // Use RPC if available, or update status manually
    const { error } = await supabase.rpc('receive_request', { request_id: reqId });

    if (error) {
       // Fallback for manual update if RPC fails/doesn't exist
       console.error("RPC Error (Inventory not updated automatically):", error);
       const { error: updateError } = await supabase.from("requests").update({ status: "completed" }).eq("id", reqId);
       if(updateError) showToast("Error updating status: " + updateError.message, "error");
       else {
         showToast("Items marked as received!", "success");
         fetchRequests(teamName);
       }
    } else {
       showToast("Items received and inventory updated!", "success");
       fetchRequests(teamName);
    }
  };
  
  const handleDailyReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const today = new Date().toISOString().split('T')[0];

    const report = {
      team: teamName,
      report_date: today,
      workers_today: Number(formData.get("workers_today") || 0),
      workers_projected: Number(formData.get("workers_projected") || 0),
      factory_total_workers: Number(formData.get("factory_total_workers") || 0),
      comments: formData.get("comments") || ""
    };

    const { error } = await supabase.from("daily_reports").insert([report]);

    if (error) {
       console.error("Report Error:", error);
       showToast("Error submitting daily report: " + error.message, "error");
    } else {
       showToast("Daily report submitted successfully!", "success");
       (e.target as HTMLFormElement).reset();
    }
  };

  const formatTicketId = (id: number) => `#${String(id).padStart(4, "0")}`;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans pb-10">
      <GlassNotification 
        message={notification.message}
        type={notification.type}
        isVisible={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />

      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white opacity-5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[50%] rounded-full bg-white opacity-5 blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-6xl p-4 md:p-8 relative z-10">
        <header className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Team Dashboard</h1>
            <p className="text-white/50 mt-1">Logged in as <span className="text-white font-medium">{teamName}</span></p>
          </div>
          <button 
            onClick={() => { localStorage.clear(); router.push("/"); }}
            className="rounded-xl border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95"
          >
            Logout
          </button>
        </header>

        {/* CURRENT HOLDINGS & STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="rounded-[2rem] bg-indigo-500/10 border border-white/10 p-6 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/></svg> 
              </div>
              <h3 className="text-4xl font-extrabold text-white mb-1">{holdings.devices}</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-200 opacity-60">My Devices</p>
           </div>
           
           <div className="rounded-[2rem] bg-fuchsia-500/10 border border-white/10 p-6 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M6 2h12v20H6z"/></svg> 
              </div>
              <h3 className="text-4xl font-extrabold text-white mb-1">{holdings.sdCards}</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-200 opacity-60">My SD Cards</p>
           </div>

           <div className="rounded-[2rem] bg-white/5 border border-white/10 p-6 backdrop-blur-md relative overflow-hidden group hover:bg-white/10 transition-colors">
              <label className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2 block">Factory Workers</label>
              <div className="flex items-end gap-3">
                 <input 
                   type="number" 
                   min="0"
                   value={workerCount}
                   onChange={(e) => updateWorkerCount(e.target.value)}
                   className="bg-transparent text-4xl font-extrabold text-white w-20 outline-none border-b border-white/20 focus:border-white/50 transition-colors pb-1"
                 />
                 <span className="text-xs text-white/40 mb-2">Total active</span>
              </div>
           </div>
        </div>

        <div className="grid gap-8 md:grid-cols-12 items-start">
          <div className="md:col-span-5 space-y-8">
            {/* Daily Reporting Card */}
            <div className="rounded-[2rem] bg-gradient-to-br from-green-900/40 to-emerald-900/20 p-6 md:p-8 backdrop-blur-2xl border border-green-500/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
               <h2 className="mb-4 text-xl font-bold border-b border-green-500/30 pb-2 flex items-center gap-2">
                  <span className="text-2xl">📋</span> Daily Deployment Log
               </h2>
               <p className="text-xs text-white/50 mb-6">Report daily device usage stats here. This data helps HQ optimize supply chains.</p>
               
               <form onSubmit={handleDailyReport} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-green-200/70 mb-2">Workers Wearing Device Today</label>
                    <input name="workers_today" type="number" min="0" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none focus:border-green-500/50" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-green-200/70 mb-2">Est. Workers Next 7 Days</label>
                    <input name="workers_projected" type="number" min="0" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none focus:border-green-500/50" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-green-200/70 mb-2">Total Workers in Factory</label>
                    <input name="factory_total_workers" type="number" min="0" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none focus:border-green-500/50" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-green-200/70 mb-2">Comments (Optional)</label>
                    <textarea name="comments" rows={2} className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none focus:border-green-500/50" />
                  </div>
                  <button type="submit" className="w-full rounded-xl bg-green-500 text-white font-bold p-3 shadow-lg hover:bg-green-400 transition-colors">
                     Submit Daily Log
                  </button>
               </form>
            </div>

            {/* New Request Form */}
            <div className="rounded-[2rem] bg-white/5 p-6 md:p-8 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
            <h2 className="mb-6 text-xl font-bold border-b border-white/10 pb-4">Create Logistics Request</h2>
            <form onSubmit={handleNewRequest} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Factory Name *</label>
                  <input name="factory_name" type="text" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Contact Person *</label>
                  <input name="person_name" type="text" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Phone Number *</label>
                  <input name="phone_number" type="text" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">POC in Factory</label>
                  <input name="poc" type="text" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" placeholder="Optional" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">City *</label>
                  <input name="city" type="text" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">State *</label>
                  <input name="state" type="text" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Complete Address *</label>
                  <input name="location" type="text" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Pincode *</label>
                  <input name="pincode" type="text" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" required />
                </div>
              </div>

              <div className="border-t border-white/10 pt-5 mt-2">
                <label className="block text-sm font-bold mb-3 tracking-wide">Enter Item Quantities</label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center group">
                    <label className="block text-xs text-white/50 mb-2 group-hover:text-white transition-colors">Devices</label>
                    <input name="device_qty" type="number" min="0" defaultValue="0" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-center text-lg font-bold text-white outline-none transition-all focus:bg-white/10 focus:border-white/30" />
                  </div>
                  <div className="text-center group">
                    <label className="block text-xs text-white/50 mb-2 group-hover:text-white transition-colors">SD Cards</label>
                    <input name="sd_card_qty" type="number" min="0" defaultValue="0" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-center text-lg font-bold text-white outline-none transition-all focus:bg-white/10 focus:border-white/30" />
                  </div>
                  <div className="text-center group">
                    <label className="block text-xs text-white/50 mb-2 group-hover:text-white transition-colors">Chargers/Hubs</label>
                    <input name="charger_hub_qty" type="number" min="0" defaultValue="0" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-center text-lg font-bold text-white outline-none transition-all focus:bg-white/10 focus:border-white/30" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Additional Comments</label>
                <textarea name="user_comment" className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white outline-none transition-all focus:bg-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10" rows={2}></textarea>
              </div>

              <button type="submit" className="w-full mt-4 rounded-xl bg-white p-4 font-bold text-black transition-all duration-300 hover:bg-neutral-200 hover:-translate-y-1 active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                Submit Request
              </button>
            </form>
          </div>

          {/* Current Status Tracker */}
          <div className="md:col-span-7 flex flex-col h-full rounded-[2rem] bg-white/5 p-6 md:p-8 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
            <h2 className="mb-6 text-xl font-bold border-b border-white/10 pb-4">My Requests Overview</h2>
            {requests.length === 0 ? (
              <p className="text-white/40 text-center py-10 italic">No logistics requests submitted yet.</p>
            ) : (
              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[800px]">
                {requests.map((req) => (
                  <div 
                    key={req.id} 
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 cursor-pointer transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5 shadow-lg group overflow-hidden relative" 
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold tracking-tight text-white group-hover:text-blue-100 transition-colors">
                        Ticket {formatTicketId(req.id)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider text-black ${
                        req.status === "sent" ? "bg-blue-300 shadow-[0_0_10px_rgba(147,197,253,0.5)]" : 
                        req.status === "approved" ? "bg-green-300 shadow-[0_0_10px_rgba(134,239,172,0.5)]" : 
                        "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]"
                      }`}>
                        {req.status === "sent" ? "Pending" : req.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <p className="font-semibold text-lg">{req.factory_name || "Factory"}</p>
                        <p className="text-xs text-white/50">{req.city ? `${req.city}, ${req.state || ''}` : req.pincode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/50 mb-1">Devices</p>
                        <p className="font-bold text-xl">{req.device_qty || 0}</p>
                      </div>
                    </div>
                    
                    {/* EXPANDED VIEW */}
                    <div className={`transition-all duration-500 ease-in-out origin-top ${expandedId === req.id ? "max-h-[1000px] opacity-100 mt-5 pt-5 border-t border-white/10" : "max-h-0 opacity-0 m-0 p-0 border-0 overflow-hidden"}`}>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm text-white/80">
                        <div><span className="block text-[10px] uppercase text-white/40 mb-1">Contact</span>{req.person_name}</div>
                        <div><span className="block text-[10px] uppercase text-white/40 mb-1">Phone</span>{req.phone_number}</div>
                        <div><span className="block text-[10px] uppercase text-white/40 mb-1">Pincode</span>{req.pincode}</div>
                        <div><span className="block text-[10px] uppercase text-white/40 mb-1">POC</span>{req.poc || "N/A"}</div>
                        <div className="col-span-2"><span className="block text-[10px] uppercase text-white/40 mb-1">Address</span>{req.location}</div>
                      </div>
                      
                      {req.tracking_id ? (
                        <div className="mt-4 p-4 bg-green-500/5 border border-green-500/10 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="block text-[10px] uppercase text-green-400/60 mb-1">Logistics Provider</span>
                            <span className="text-lg font-bold text-green-300">{req.courier_name || "Courier"}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] uppercase text-green-400/60 mb-1">Tracking ID</span>
                            <span className="font-mono text-lg text-white">{req.tracking_id}</span>
                          </div>
                        </div>
                      ) : null}

                      {req.status === "approved" && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleMarkReceived(req.id); }}
                             className="w-full rounded-xl bg-green-500/20 text-green-300 font-bold p-3 border border-green-500/30 hover:bg-green-500/30 transition-all"
                           >
                             Confirm Items Received
                           </button>
                           <p className="text-center text-[10px] text-white/40 mt-2">Clicking this confirms you have physically received the package.</p>
                        </div>
                      )}
                    </div> 
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


