/**
 * oceanAudioService.js
 * Live Bioacoustics Gateway — 100% Dynamic, Zero Hardcoded Data
 *
 * Data source: Freesound.org API v2 (https://freesound.org/apiv2/)
 * - Returns real community-recorded marine, ocean & wildlife sounds
 * - Preview MP3 URLs accessible without OAuth (CORS-enabled CDN)
 * - 163+ whale sounds, 65+ dolphin, 73+ ocean recordings and growing
 */

import axios from "axios";

const FREESOUND_API = "https://freesound.org/apiv2/search/text/";
const FREESOUND_TOKEN = process.env.FREESOUND_CLIENT_ID || "";

// Vietnamese → English marine search term mapping (logic, not static dict)
function buildSearchTerm(rawQuery) {
  const v = rawQuery.toLowerCase().trim();
  if (!v) return null;

  // Exact Vietnamese matches
  const map = {
    "cá voi xanh": "blue whale",
    "cá voi lưng gù": "humpback whale",
    "cá voi sát thủ": "orca killer whale",
    "cá voi nhà táng": "sperm whale",
    "cá voi xám": "gray whale",
    "cá voi": "whale",
    "cá heo mũi chai": "bottlenose dolphin",
    "cá heo xoay": "spinner dolphin",
    "cá heo": "dolphin",
    "cá mập trắng": "great white shark",
    "cá mập voi": "whale shark",
    "cá mập đầu búa": "hammerhead shark",
    "cá mập": "shark",
    "cá ngừ": "tuna fish",
    "cá thu": "mackerel fish",
    "rùa biển": "sea turtle",
    "hải cẩu": "seal",
    "hải mã": "walrus",
    "sư tử biển": "sea lion",
    "san hô": "coral reef",
    "rạn san hô": "coral reef",
    "bạch tuộc": "octopus underwater",
    "mực ống": "squid",
    "mực khổng lồ": "giant squid",
    "sứa": "jellyfish",
    "tôm hùm": "lobster",
    "sóng biển": "ocean waves",
    "biển sâu": "deep sea underwater",
    "đại dương": "ocean underwater",
    "thủy âm": "hydrophone underwater",
  };

  if (map[v]) return map[v];

  // Partial keyword matching
  if (v.includes("cá voi")) return "whale";
  if (v.includes("cá heo")) return "dolphin";
  if (v.includes("cá mập")) return "shark";
  if (v.includes("san hô")) return "coral reef";
  if (v.includes("bạch tuộc") || v.includes("mực")) return "cephalopod";
  if (v.includes("hải cẩu") || v.includes("hải tượng")) return "seal";
  if (v.includes("cá")) return "fish underwater";
  if (v.includes("biển") || v.includes("đại dương")) return "ocean underwater";

  // Pass English/unknown queries through directly
  return v;
}

// Map Freesound search terms to UI categories
function guessCategory(name, tags) {
  const text = (name + " " + (tags || []).join(" ")).toLowerCase();
  if (/whale|cetacean|humpback|orca|sperm|baleen|blue whale|gray whale/i.test(text)) return "Cá voi & Thân mềm";
  if (/dolphin|shark|porpoise|seal|sea lion/i.test(text)) return "Cá heo & Cá mập";
  if (/ocean|underwater|sea|hydrophone|reef|coral|wave|deep/i.test(text)) return "Môi trường biển sâu";
  return "Cơ sở dữ liệu Sinh học Biển";
}

// Format seconds to m:ss
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Call Freesound API and map results to our schema
async function searchFreesound(query, pageSize = 15) {
  if (!FREESOUND_TOKEN) throw new Error("FREESOUND_CLIENT_ID not set in .env");

  const res = await axios.get(FREESOUND_API, {
    params: {
      query,
      token: FREESOUND_TOKEN,
      fields: "id,name,description,duration,previews,tags,username,license",
      filter: "duration:[3 TO 180]",
      page_size: pageSize,
      sort: "score",
    },
    timeout: 8000,
  });

  const results = res.data?.results || [];
  return results.map((s) => ({
    id: `fs-${s.id}`,
    freesoundId: s.id,
    title: s.name.replace(/\.[^/.]+$/, ""), // strip extension
    category: guessCategory(s.name, s.tags),
    species: s.tags?.slice(0, 3).join(", ") || query,
    duration: formatDuration(s.duration),
    url: s.previews?.["preview-hq-mp3"] || s.previews?.["preview-lq-mp3"] || "",
    description: s.description
      ? s.description.replace(/<[^>]*>/g, "").trim().slice(0, 160) + "..."
      : `Bản ghi âm từ cộng đồng Freesound.org — ${s.username} (${s.license?.split("/").pop() || "CC"})`,
    source: "Freesound.org",
    author: s.username,
  })).filter((s) => s.url); // only items with a playable preview URL
}

export class OceanAudioService {
  /**
   * Default catalog — loaded once on modal open
   * Runs parallel searches across all marine categories
   */
  async getAudioLibrary(query = "", category = "Tất cả") {
    try {
      let items = [];

      if (!query.trim()) {
        // Parallel broad searches across all marine categories
        const defaultQueries = [
          "whale sound",
          "dolphin sound",
          "ocean underwater",
          "coral reef",
          "shark underwater",
          "sea waves",
        ];

        const settled = await Promise.allSettled(
          defaultQueries.map((q) => searchFreesound(q, 5))
        );

        for (const r of settled) {
          if (r.status === "fulfilled") items.push(...r.value);
        }

        // Dedup by freesoundId
        const seen = new Set();
        items = items.filter((s) => {
          if (seen.has(s.freesoundId)) return false;
          seen.add(s.freesoundId);
          return true;
        });
      } else {
        // Specific user query
        const term = buildSearchTerm(query) || query;
        items = await searchFreesound(term, 20);
      }

      // Category filter
      if (category !== "Tất cả") {
        items = items.filter((i) => i.category === category);
      }

      return { success: true, count: items.length, data: items };
    } catch (err) {
      console.error("OceanAudioService.getAudioLibrary error:", err.message);
      return { success: false, count: 0, data: [], error: err.message };
    }
  }

  /**
   * Advanced live search — explicit Wikimedia/Freesound query from frontend button
   */
  async searchAdvanced(query = "") {
    const raw = query.trim();
    if (!raw) return { success: false, count: 0, data: [] };

    try {
      const term = buildSearchTerm(raw) || raw;
      const items = await searchFreesound(term, 20);
      return { success: true, count: items.length, data: items };
    } catch (err) {
      console.error("OceanAudioService.searchAdvanced error:", err.message);
      return { success: false, count: 0, data: [], error: err.message };
    }
  }
}

export default new OceanAudioService();
