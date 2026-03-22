"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [teamName, setTeamName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [teamsList, setTeamsList] = useState<{name: string, role: string}[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function fetchTeams() {
      const { data, error } = await supabase.from("teams").select("name, role");
      if (data && !error) {
        setTeamsList(data);
      }
    }
    fetchTeams();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName && phoneNumber) {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .ilike("name", teamName)
        .eq("phone", phoneNumber)
        .single();

      if (error || !data) {
        alert("Incorrect Phone Number for this Account!");
        return;
      }

      localStorage.setItem("teamName", data.name);
      localStorage.setItem("role", data.role); // Store role to make redirect checks robust
      localStorage.setItem("phoneNumber", phoneNumber);

      if (data.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-gray-900 border-b pb-4">Logistics Portal</h1>
        <form onSubmit={handleLogin} className="space-y-4 text-black">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Account Name</label>
            <select
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              required
            >
              <option value="" disabled>Select your account</option>
              {teamsList.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number (Password)</label>
            <input
              type="password"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. 9876543210"
              required
            />
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-blue-600 p-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Enter Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

