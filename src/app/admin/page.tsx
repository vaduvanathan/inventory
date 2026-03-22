
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPhone, setNewTeamPhone] = useState("");
  const router = useRouter();

  useEffect(() => {
    const storedTeam = localStorage.getItem("teamName");
    if (storedTeam?.toLowerCase() !== "admin") {
      router.push("/");
    } else {
      fetchRequests();
    }
  }, [router]);

  async function fetchRequests() {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("Fetch requests error:", error);
    if (data) setRequests(data);
  }

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from("requests").update({ status: newStatus }).eq("id", id);
    fetchRequests(); // Refresh data
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName || !newTeamPhone) return;

    const { error } = await supabase.from("teams").insert([
      { name: newTeamName, phone: String(newTeamPhone), role: "team" }
    ]);

    if (error) {
      console.error("Insert error:", error);
      alert("Error adding team: " + error.message);
    } else {
      alert("Team added successfully!");
      setNewTeamName("");
      setNewTeamPhone("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">HQ Admin Dashboard</h1>
          <button 
            onClick={() => { localStorage.clear(); router.push("/"); }}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </header>

        {/* Requests Table */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold border-b pb-2">All Active Requests</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="p-3">Ticket ID</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">Item</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-500">No requests in the system.</td>
                  </tr>
                ) : (
                  requests.map((req, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-3 font-semibold">{req.id}</td>
                      <td className="p-3">{req.team}</td>
                      <td className="p-3">{req.item}</td>
                      <td className="p-3">{req.quantity}</td>
                      <td className="p-3 max-w-[200px] truncate">{req.location}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs text-white ${req.status === "sent" ? "bg-blue-500" : req.status === "approved" ? "bg-green-500" : "bg-red-500"}`}>
                          {req.status === "sent" ? "Pending" : req.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 space-x-2">
                        {req.status === "sent" && (
                          <>
                            <button onClick={() => updateStatus(req.id, "approved")} className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Approve</button>
                            <button onClick={() => updateStatus(req.id, "denied")} className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">Deny</button>
                          </>
                        )}
                        {req.status === "approved" && <span className="font-bold text-green-600">Approved</span>}
                        {req.status === "denied" && <span className="font-bold text-red-600">Denied</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Tools - Add New User */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold border-b pb-2">Add New Team / User</h2>
          <form onSubmit={handleCreateTeam} className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">New Team Name</label>
              <input
                type="text"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                className="w-full rounded border p-2 text-black"
                placeholder="e.g. Mytron Labs (Surat)"
                required
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number (Password)</label>
              <input
                type="text"
                value={newTeamPhone}
                onChange={e => setNewTeamPhone(e.target.value)}
                className="w-full rounded border p-2 text-black"
                placeholder="e.g. 9876543210"
                required
              />
            </div>
            <button type="submit" className="rounded bg-blue-600 px-6 py-2 font-bold text-white hover:bg-blue-700">
              Create User
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

