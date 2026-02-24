import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

function AIRecommender() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [eventId, setEventId] = useState(null);

  const getRecommendations = async () => {
    if (!query.trim()) {
      toast.error("Please enter what you want to learn");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post("http://localhost:4001/ai/recommend", {
        query,
        limit: 4,
      });

      setRecommendations(res.data.recommendations || []);
      setEventId(res.data.eventId || null);

      if (!res.data.recommendations?.length) {
        toast("No matches found. Try a different prompt.");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to fetch AI recommendations");
    } finally {
      setLoading(false);
    }
  };

  const trackClick = async (bookId) => {
    try {
      await axios.post("http://localhost:4001/ai/select", {
        eventId,
        bookId,
        query,
      });
    } catch (error) {
      console.log("Tracking error", error?.message);
    }
  };

  return (
    <div className="mt-8 p-5 border rounded-xl bg-base-100 dark:bg-slate-800">
      <h2 className="text-xl font-bold">Ask AI for Book Suggestions</h2>
      <p className="text-sm mt-1 opacity-80">
        Example: free beginner JavaScript books under $20
      </p>

      <div className="mt-4 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input input-bordered w-full"
          placeholder="Describe what you want to learn"
        />
        <button className="btn btn-secondary" onClick={getRecommendations} disabled={loading}>
          {loading ? "Thinking..." : "Get Suggestions"}
        </button>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((book) => (
            <div key={book._id} className="p-4 rounded-lg border bg-base-200 dark:bg-slate-700">
              <h3 className="font-semibold">{book.name}</h3>
              <p className="text-sm mt-1">{book.title}</p>
              <p className="text-xs mt-2">
                <span className="font-medium">Why this:</span> {book.reason}
              </p>
              <div className="mt-3 flex justify-between items-center">
                <span className="badge badge-outline">${book.price}</span>
                <button className="btn btn-sm btn-outline" onClick={() => trackClick(book._id)}>
                  I like this
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AIRecommender;
