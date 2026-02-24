import mongoose from "mongoose";

const aiEventSchema = mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["recommendation_served", "recommendation_clicked"],
      required: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
    },
    recommendedBookIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    ],
    selectedBookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
    },
  },
  { timestamps: true }
);

const AIEvent = mongoose.model("AIEvent", aiEventSchema);

export default AIEvent;
