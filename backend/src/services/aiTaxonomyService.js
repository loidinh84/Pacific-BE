import { translateMarineQuery, VIETNAMESE_MARINE_DICTIONARY } from "../config/marineDictionary.js";

const KNOWN_FRESHWATER_SPECIES = {
  "lươn điện": { sciName: "Electrophorus electricus", commonVi: "Lươn điện (Electric Eel)", reasoning: "Lươn điện là loài cá chình điện nước ngọt lưu vực sông Amazon, không thuộc hệ sinh thái biển Thái Bình Dương." },
  "luon dien": { sciName: "Electrophorus electricus", commonVi: "Lươn điện (Electric Eel)", reasoning: "Lươn điện là loài cá chình điện nước ngọt lưu vực sông Amazon, không thuộc hệ sinh thái biển Thái Bình Dương." },
  "cá rồng": { sciName: "Osteoglossidae", commonVi: "Cá rồng (Arowana)", reasoning: "Cá rồng là loài cá nước ngọt nhiệt đới, không thuộc hệ sinh thái biển Thái Bình Dương." },
  "cá lóc": { sciName: "Channa striata", commonVi: "Cá lóc (Snakehead)", reasoning: "Cá lóc là loài cá nước ngọt đầm lầy, không thuộc hệ sinh thái đại dương." },
};

const KNOWN_FICTIONAL_SPECIES = ["godzilla", "pikachu", "chocobo", "dragon", "rồng sấm", "người cá fiction", "super saiyan"];

// Terrestrial check with exact whole-word matching (avoids matching 'hổ' in 'khổng lồ')
const TERRESTRIAL_REGEX = /(?:^|\s)(con\s+hổ|hổ\s+vằn|panthera\s+tigris|con\s+voi|con\s+ngựa|chó\s+nhà|mèo\s+nhà|chó\s+sói|con\s+gấu\s+bắc\s+cực|con\s+gấu\s+nâu)(?:$|\s)/i;

export class AITaxonomyService {
  async analyzeWithAI(rawQuery) {
    const cleanQ = (rawQuery || "").trim().toLowerCase();
    console.log(`[AI TAXONOMY AGENT] Tra cứu từ khóa: "${rawQuery}"`);

    // 0. Check Marine Dictionary first (Always prioritizes verified ocean creatures)
    const isMarineInDict = Boolean(VIETNAMESE_MARINE_DICTIONARY[cleanQ]) ||
      cleanQ.includes("bạch tuộc") ||
      cleanQ.includes("cá mập") ||
      cleanQ.includes("cá voi") ||
      cleanQ.includes("cá heo") ||
      cleanQ.includes("mực khổng lồ") ||
      cleanQ.includes("sứa") ||
      cleanQ.includes("san hô");

    // 1. Check Sci-Fi / Fictional Entities
    if (KNOWN_FICTIONAL_SPECIES.some((f) => cleanQ.includes(f))) {
      console.log(`[AI TAXONOMY AGENT] Nhận diện: Loài Viễn Tưởng ("${rawQuery}")`);
      return {
        isValidCreature: false,
        isMarine: false,
        scientificName: null,
        commonNameVi: rawQuery,
        reasoning: `Từ khóa "${rawQuery}" là sinh vật viễn tưởng / không có thật trong tự nhiên.`,
      };
    }

    // 2. Check Terrestrial (Land) Animals (Only if NOT a known marine animal)
    if (!isMarineInDict && TERRESTRIAL_REGEX.test(cleanQ)) {
      console.log(`[AI TAXONOMY AGENT] Nhận diện: Động vật trên cạn ("${rawQuery}")`);
      return {
        isValidCreature: true,
        isMarine: false,
        scientificName: "Terrestrial Animalia",
        commonNameVi: rawQuery,
        descriptionVi: `Sinh vật "${rawQuery}" thuộc nhóm động vật sống trên đất liền.`,
        bioSpecs: { groupId: "2", sizeMinCm: "100", sizeMaxCm: "300", weightMinKg: "50", weightMaxKg: "500", lifespanYears: "15" },
        reasoning: `Sinh vật "${rawQuery}" thuộc nhóm động vật trên cạn.`,
      };
    }

    // 3. Check Freshwater Species
    if (KNOWN_FRESHWATER_SPECIES[cleanQ]) {
      const info = KNOWN_FRESHWATER_SPECIES[cleanQ];
      console.log(`[AI TAXONOMY AGENT] Nhận diện: Cá nước ngọt ("${info.commonVi}")`);
      return {
        isValidCreature: true,
        isMarine: false,
        scientificName: info.sciName,
        commonNameVi: info.commonVi,
        descriptionVi: info.reasoning,
        bioSpecs: { groupId: "4", oceanZone: "Sunlight", diet: "Kẻ săn mồi (Carnivore)", depthMin: "0", depthMax: "10", sizeMinCm: "100", sizeMaxCm: "250", weightMinKg: "5", weightMaxKg: "20", lifespanYears: "15", tempMinC: "22", tempMaxC: "28" },
        reasoning: info.reasoning,
      };
    }

    // 4. Gemini Flash API
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        const systemPrompt = `Analyze query for marine biology database. Return JSON: { isValidCreature: bool, isMarine: bool, scientificName: str|null, commonNameVi: str, descriptionVi: str, bioSpecs: obj, reasoning: str }`;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: systemPrompt }, { text: `Query: "${rawQuery}"` }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          const textOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textOutput) {
            const parsedData = JSON.parse(textOutput.replace(/```json|```/g, "").trim());
            console.log(`[AI TAXONOMY AGENT] Gemini API SciName: ${parsedData.scientificName}`);
            return parsedData;
          }
        }
      } catch (err) {
        console.warn("Gemini API error:", err.message);
      }
    }

    return null;
  }
}

export default new AITaxonomyService();
