import Book from "../model/book.model.js";
import AIEvent from "../model/aiEvent.model.js";

const parsePreferences = (query = "") => {
  const text = query.toLowerCase();
  const prefs = {
    category: null,
    budget: null,
    level: null,
  };

  if (text.includes("free")) prefs.category = "Free";
  if (text.includes("paid") || text.includes("premium")) prefs.category = "Paid";

  const budgetMatch = text.match(/\$(\d+)/) || text.match(/under\s*(\d+)/);
  if (budgetMatch) prefs.budget = Number(budgetMatch[1]);

  if (text.includes("beginner")) prefs.level = "beginner";
  if (text.includes("advanced")) prefs.level = "advanced";

  return prefs;
};

const buildReason = (book, prefs) => {
  const reasons = [];

  if (prefs.category && book.category?.toLowerCase() === prefs.category.toLowerCase()) {
    reasons.push(`matches your ${prefs.category.toLowerCase()} preference`);
  }

  if (prefs.budget !== null && typeof book.price === "number" && book.price <= prefs.budget) {
    reasons.push(`fits your budget (≤ $${prefs.budget})`);
  }

  if (prefs.level && book.title?.toLowerCase().includes(prefs.level)) {
    reasons.push(`looks suitable for ${prefs.level} learners`);
  }

  if (reasons.length === 0) {
    reasons.push("matches your query topic based on available metadata");
  }

  return reasons.join(", ");
};

const scoreBook = (book, prefs, queryTokens) => {
  let score = 0;

  if (prefs.category && book.category?.toLowerCase() === prefs.category.toLowerCase()) {
    score += 50;
  }

  if (prefs.budget !== null && typeof book.price === "number") {
    score += book.price <= prefs.budget ? 20 : -10;
  }

  const searchable = `${book.name || ""} ${book.title || ""} ${book.category || ""}`.toLowerCase();
  queryTokens.forEach((token) => {
    if (token.length > 2 && searchable.includes(token)) score += 5;
  });

  return score;
};

export const recommendBooks = async (req, res) => {
  try {
    const { query, limit = 3 } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ message: "Query is required" });
    }

    const books = await Book.find();
    if (!books.length) {
      return res.status(200).json({ query, recommendations: [] });
    }

    const prefs = parsePreferences(query);
    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    const ranked = books
      .map((book) => ({
        ...book.toObject(),
        score: scoreBook(book, prefs, queryTokens),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Number(limit) || 3))
      .map((book) => ({
        _id: book._id,
        name: book.name,
        title: book.title,
        category: book.category,
        price: book.price,
        image: book.image,
        reason: buildReason(book, prefs),
      }));

    const event = await AIEvent.create({
      type: "recommendation_served",
      query,
      recommendedBookIds: ranked.map((book) => book._id),
    });

    res.status(200).json({ query, eventId: event._id, recommendations: ranked });
  } catch (error) {
    console.log("AI recommend error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const trackRecommendationClick = async (req, res) => {
  try {
    const { eventId, bookId, query } = req.body;

    if (!bookId || !query) {
      return res.status(400).json({ message: "bookId and query are required" });
    }

    await AIEvent.create({
      type: "recommendation_clicked",
      query,
      selectedBookId: bookId,
      recommendedBookIds: eventId ? undefined : [bookId],
    });

    res.status(200).json({ message: "Click tracked" });
  } catch (error) {
    console.log("AI click tracking error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const getAIMetrics = async (_req, res) => {
  try {
    const servedCount = await AIEvent.countDocuments({ type: "recommendation_served" });
    const clickCount = await AIEvent.countDocuments({ type: "recommendation_clicked" });

    const ctr = servedCount > 0 ? Number(((clickCount / servedCount) * 100).toFixed(2)) : 0;

    const topPrompts = await AIEvent.aggregate([
      { $match: { type: "recommendation_served" } },
      { $group: { _id: "$query", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, query: "$_id", count: 1 } },
    ]);

    const topClickedBooks = await AIEvent.aggregate([
      { $match: { type: "recommendation_clicked", selectedBookId: { $exists: true } } },
      { $group: { _id: "$selectedBookId", clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "books",
          localField: "_id",
          foreignField: "_id",
          as: "book",
        },
      },
      {
        $project: {
          _id: 0,
          bookId: "$_id",
          clicks: 1,
          name: { $ifNull: [{ $arrayElemAt: ["$book.name", 0] }, "Unknown"] },
          category: { $ifNull: [{ $arrayElemAt: ["$book.category", 0] }, null] },
        },
      },
    ]);

    res.status(200).json({
      totals: {
        recommendationServed: servedCount,
        recommendationClicked: clickCount,
      },
      ctr,
      topPrompts,
      topClickedBooks,
    });
  } catch (error) {
    console.log("AI metrics error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
