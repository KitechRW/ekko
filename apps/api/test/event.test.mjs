import test from "node:test";
import assert from "node:assert/strict";
import { extractYouTubeVideoId, validateEvent } from "../src/event.mjs";

const ID = "jfKfPfyJRdk";

test("accepts supported YouTube live/video URLs", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=" + ID,
    "https://youtube.com/live/" + ID + "?feature=share",
    "https://youtu.be/" + ID,
    "https://www.youtube-nocookie.com/embed/" + ID,
    "https://m.youtube.com/watch?v=" + ID
  ]) assert.equal(extractYouTubeVideoId(url), ID);
});

test("rejects unknown hosts, HTTP, and malformed IDs", () => {
  for (const url of [
    "https://youtube.com.evil.example/watch?v=" + ID,
    "http://www.youtube.com/watch?v=" + ID,
    "https://youtube.com/watch?v=bad",
    "https://youtu.be/" + ID + "/other",
    "not a URL"
  ]) assert.equal(extractYouTubeVideoId(url), null);
});

test("normalizes event fields and status", () => {
  const result = validateEvent({
    churchName: " Zion Temple ",
    title: " Worship ",
    youtubeUrl: "https://youtu.be/" + ID,
    status: "live",
    scheduledStartAt: "2026-10-11T09:00:00.000Z"
  });
  assert.equal(result.youtubeVideoId, ID);
  assert.equal(result.title, "Worship");
  assert.equal(result.id, "featured");
  assert.equal(result.scheduledStartAt, "2026-10-11T09:00:00.000Z");
});

test("rejects incorrect payloads", () => {
  assert.throws(() => validateEvent({ title: "Test", churchName: "A", youtubeUrl: "https://youtu.be/bad", status: "live" }));
  assert.throws(() => validateEvent({ title: "Test", churchName: "A", youtubeUrl: "https://youtu.be/" + ID, status: "unknown" }));
  assert.throws(() => validateEvent({ title: "<".repeat(141), churchName: "A", youtubeUrl: "https://youtu.be/" + ID, status: "live" }));
});
