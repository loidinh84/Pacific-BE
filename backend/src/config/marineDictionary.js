/**
 * marineDictionary.js
 * Permanent Multilingual Marine Species Translation & Normalization Dictionary
 * Resolves Vietnamese ocean terms to Canonical Scientific / International English names.
 */

export const VIETNAMESE_MARINE_DICTIONARY = {
  // Cá heo, Cá voi, Hải cẩu, Bò biển
  "cá heo": "dolphin",
  "ca heo": "dolphin",
  "cá heo mỏ dài": "spinner dolphin",
  "cá heo mũi chai": "bottlenose dolphin",
  "cá voi": "whale",
  "ca voi": "whale",
  "cá voi xanh": "blue whale",
  "cá voi sát thủ": "orca",
  "orca": "orca",
  "hải cẩu": "seal",
  "hai cau": "seal",
  "sư tử biển": "sea lion",
  "bò biển": "dugong",
  "bo bien": "dugong",

  // Cá lồng đèn, Lươn biển, Cá mập, Cá đuối
  "cá lồng đèn": "lanternfish",
  "ca long den": "lanternfish",
  "cá lồng đèn biển": "lanternfish",
  "lươn biển": "moray eel",
  "luon bien": "moray eel",
  "cá chình biển": "moray eel",
  "cá mập": "shark",
  "ca map": "shark",
  "cá mập trắng": "great white shark",
  "cá mập búa": "hammerhead shark",
  "cá mập voi": "whale shark",
  "cá mập hổ": "tiger shark",
  "cá đuối": "manta ray",
  "ca duoi": "manta ray",
  "cá đuối manta": "manta ray",

  // Sứa, Bạch tuộc, Mực, Rùa biển
  "sứa": "jellyfish",
  "sua": "jellyfish",
  "sứa trăng": "moon jellyfish",
  "sứa mặt trăng": "moon jellyfish",
  "sứa lửa": "sea nettle",
  "bạch tuộc": "octopus",
  "bach tuoc": "octopus",
  "bạch tuộc khổng lồ": "giant pacific octopus",
  "mực": "squid",
  "muc": "squid",
  "mực khổng lồ": "giant squid",
  "rùa biển": "sea turtle",
  "rua bien": "sea turtle",
  "rùa dứa": "green sea turtle",
  "rùa da": "leatherback sea turtle",

  // Cá rạn san hô & cá biển
  "cá hề": "clownfish",
  "ca he": "clownfish",
  "cá ngừ": "bluefin tuna",
  "ca ngu": "tuna",
  "cá ngừ đại dương": "bluefin tuna",
  "cá cờ": "sailfish",
  "cá hồi": "salmon",
  "cá đuôi xanh": "blue tang",
  "cá thia": "damselfish",
  "cá chuồn": "flying fish",
  "cá ngựa": "seahorse",
  "ca ngua": "seahorse",

  // Thân mềm, Giáp xác, San hô, Sao biển
  "tôm hùm": "lobster",
  "tom hum": "lobster",
  "cua biển": "crab",
  "cua bien": "crab",
  "san hô": "coral",
  "san ho": "coral",
  "sao biển": "starfish",
  "sao bien": "starfish",
  "hải sâm": "sea cucumber",
  "hai sam": "sea cucumber",
  "cầu gai": "sea urchin",
  "cau gai": "sea urchin",
  "bọt biển": "sea sponge",
  "bot bien": "sea sponge",
  "chim cánh cụt": "penguin",
  "chim canh cut": "penguin",
};

/**
 * Translate query or return raw
 * @param {string} rawQuery 
 * @returns {string}
 */
export function translateMarineQuery(rawQuery) {
  if (!rawQuery) return "";
  const cleanKey = rawQuery.trim().toLowerCase();
  return VIETNAMESE_MARINE_DICTIONARY[cleanKey] || rawQuery.trim();
}
