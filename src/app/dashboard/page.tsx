"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [teamName, setTeamName] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storedTeam = localStorage.getItem("teamName");
    if (!storedTeam) {
      router.push("/");
    } else {
      setTeamName(storedTeam);
      fetchRequests(storedTeam);
    }
  }, [router]);

  async function fetchRequests(team: string) {
    const { data } = await supabase
      .from("requests")
      .select("*")
      .eq("team", team)
      .order("created_at", { ascending: false });
    if (data) setRequests(data);
  }

  const handleNewRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newRequest = {
      team: teamName,
      item: formData.get("item"),
      quantity: Number(formData.get("quantity")),
      location: formData.get("location"),
      status: "sent"
    };

    const { error } = await supabase.from("requests").insert([newRequest]);
    
    if (!error) {
      fetchRequests(teamName); // Refresh the list
      (e.target as HTMLFormElement).reset();
    } else {
      console.error("Supabase Error: ", error);
      alert("Error submitting request: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Team Dashboard: {teamName}</h1>
          <button 
            onClick={() => { localStorage.clear(); router.push("/"); }}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          {/* New Request Form */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold border-b pb-2">Create New Request</h2>
            <form onSubmit={handleNewRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Item</label>
                <select name="item" className="w-full rounded border p-2 text-black" required>
                  <option value="">Select an Item</option>
                  <option value="Device">Device</option>
                  <option value="SD Card">SD Card</option>
                  <option value="Charger Hub">Charger Hub</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Quantity</label>
                <input name="quantity" type="number" className="w-full rounded border p-2 text-black" required min="1" />
              </div>
              <div>
                <label className="block text-sm font-medium">Location / Address</label>
                <textarea name="location" className="w-full rounded border p-2 text-black" required></textarea>
              </div>
              <button type="submit" className="w-full rounded bg-green-600 p-2 font-bold text-white hover:bg-green-700">
                Submit Request
              </button>
            </form>
          </div>

          {/* Current Status Tracker */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold border-b pb-2">My Requests</h2>
            {requests.length === 0 ? (
              <p className="text-gray-500">No requests submitted yet.</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {requests.map((req, i) => (
                  <div key={i} className="rounded border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-bold">Request #{req.id}</span>
                      <span className={`px-2 py-1 rounded text-xs text-white ${req.status === "sent" ? "bg-blue-500" : req.status === "approved" ? "bg-green-500" : "bg-red-500"}`}>
                        {req.status === "sent" ? "Pending" : req.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm">Item: {req.quantity}x {req.item}</p>
                    <p className="text-sm text-gray-500">{new Date(req.created_at || Date.now()).toLocaleString()}</p>
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

