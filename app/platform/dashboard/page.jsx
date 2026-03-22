"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState([]);

 async function fetchData() {
  try {
    const res = await fetch("/api/get-analytics");

    if (!res.ok) {
      const text = await res.text();
      console.error("API ERROR:", text);
      return;
    }

    const data = await res.json();
    console.log("DATA:", data);

    // setData(data.visitors || []); /**replacede with  */
    setData(data.pageViews || []);
  } catch (err) {
    console.error("FETCH FAILED:", err);
  }
}

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 30000); // 30 sec

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}