import prisma from "../lib/prisma.js";

const SETTING_KEY = "external_api_providers";
const SETTING_GROUP = "api_sync";

export const DEFAULT_API_PROVIDERS = [
  {
    id: "gbif",
    name: "GBIF API",
    desc: "Mạng lưới Thông tin Đa dạng Sinh học Toàn cầu",
    category: "biodiversity",
    endpoint: "https://api.gbif.org/v1/species/match?name=Orcinus+orca",
    docsUrl: "https://www.gbif.org/developer/species",
    isEnabled: true,
    isBuiltIn: true,
    requiresKey: false,
    headers: { "Accept": "application/json" },
  },
  {
    id: "inaturalist",
    name: "iNaturalist API",
    desc: "Cơ sở dữ liệu hình ảnh & quan sát cộng đồng của Viện Hàn lâm Khoa học California",
    category: "media",
    endpoint: "https://api.inaturalist.org/v1/taxa?q=whale&per_page=1",
    docsUrl: "https://api.inaturalist.org/v1/docs/",
    isEnabled: true,
    isBuiltIn: true,
    requiresKey: false,
    headers: { "User-Agent": "PacificOceanApp/1.0" },
  },
  {
    id: "worms",
    name: "WoRMS Registry",
    desc: "Sổ Đăng kiểm Sinh vật biển Thế giới",
    category: "taxonomy",
    endpoint: "https://www.marinespecies.org/rest/AphiaRecordsByName/Delphinidae?like=false",
    docsUrl: "https://www.marinespecies.org/rest/",
    isEnabled: true,
    isBuiltIn: true,
    requiresKey: false,
    headers: { "Accept": "application/json" },
  },
  {
    id: "obis",
    name: "OBIS Ocean API",
    desc: "Hệ thống Thông tin Đa dạng Sinh thái Đại dương",
    category: "oceanography",
    endpoint: "https://api.obis.org/v3/taxon/2688",
    docsUrl: "https://api.obis.org/",
    isEnabled: true,
    isBuiltIn: true,
    requiresKey: false,
    headers: { "Accept": "application/json" },
  },
  {
    id: "wikipedia",
    name: "Wikipedia API",
    desc: "Bách khoa toàn thư mở Wikipedia",
    category: "encyclopedia",
    endpoint: "https://vi.wikipedia.org/api/rest_v1/page/summary/Orcinus_orca",
    docsUrl: "https://en.wikipedia.org/api/rest_v1/",
    isEnabled: true,
    isBuiltIn: true,
    requiresKey: false,
    headers: { "User-Agent": "PacificOceanApp/1.0 (contact@pacific.org)" },
  },
  {
    id: "fishbase",
    name: "FishBase Traits",
    desc: "Chỉ số sinh học, kích thước và độ sâu loài cá",
    category: "traits",
    endpoint: "https://api.gbif.org/v1/species?datasetKey=d9a4eedb-e985-4456-ad46-3df8472e00e8&limit=1",
    docsUrl: "https://www.fishbase.se/",
    isEnabled: true,
    isBuiltIn: true,
    requiresKey: false,
    headers: { "Accept": "application/json" },
  },
  {
    id: "eol",
    name: "Encyclopedia of Life (EOL)",
    desc: "Bách khoa toàn thư Sự sống Toàn cầu",
    category: "encyclopedia",
    endpoint: "https://eol.org/api/search/1.0.json?q=octopus&page=1",
    docsUrl: "https://eol.org/docs/what-is-eol/data-services/classic-apis",
    isEnabled: true,
    isBuiltIn: false,
    requiresKey: false,
    headers: { "Accept": "application/json" },
  },
  {
    id: "noaa",
    name: "NOAA Ocean Explorer",
    desc: "Dữ liệu Hải dương học & Rạn san hô Quốc gia Hoa Kỳ",
    category: "oceanography",
    endpoint: "https://www.ncei.noaa.gov",
    docsUrl: "https://www.ncei.noaa.gov/",
    isEnabled: true,
    isBuiltIn: false,
    requiresKey: false,
    headers: { "Accept": "application/json" },
  },
];

export class ApiProviderService {
  /**
   * Load providers from PostgreSQL system_settings or initialize defaults
   */
  async getRawProviders() {
    try {
      const setting = await prisma.system_settings.findUnique({
        where: { setting_key: SETTING_KEY },
      });

      if (setting && setting.setting_value) {
        let parsed = setting.setting_value;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            parsed = DEFAULT_API_PROVIDERS;
          }
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with any new default built-in providers if not present
          const existingIds = new Set(parsed.map((p) => p.id));
          for (const def of DEFAULT_API_PROVIDERS) {
            if (!existingIds.has(def.id)) {
              parsed.push(def);
            }
          }
          return parsed;
        }
      }

      // Initial save to database
      await this.saveProviders(DEFAULT_API_PROVIDERS);
      return DEFAULT_API_PROVIDERS;
    } catch (err) {
      console.warn("[API PROVIDER SERVICE] Lỗi đọc DB, sử dụng mặc định:", err.message);
      return DEFAULT_API_PROVIDERS;
    }
  }

  /**
   * Persist provider list into system_settings table
   */
  async saveProviders(providers) {
    try {
      await prisma.system_settings.upsert({
        where: { setting_key: SETTING_KEY },
        update: {
          setting_value: providers,
          setting_group: SETTING_GROUP,
          updated_at: new Date(),
        },
        create: {
          setting_key: SETTING_KEY,
          setting_value: providers,
          setting_group: SETTING_GROUP,
          updated_at: new Date(),
        },
      });
      return true;
    } catch (err) {
      console.error("[API PROVIDER SERVICE] Lỗi lưu system_settings:", err);
      return false;
    }
  }

  /**
   * Get all configured providers with live ping summary
   */
  async getAllProviders(includePing = false) {
    const providers = await this.getRawProviders();

    if (!includePing) {
      return providers.map((p) => ({
        ...p,
        status: p.isEnabled ? "ok" : "disabled",
      }));
    }

    // Parallel ping health test for active providers
    const tested = await Promise.all(
      providers.map(async (p) => {
        if (!p.isEnabled) {
          return { ...p, status: "disabled", responseTimeMs: null };
        }
        const pingRes = await this.pingEndpoint(p.endpoint, p.headers, p.apiKey);
        return {
          ...p,
          status: pingRes.status,
          responseTimeMs: pingRes.responseTimeMs,
          statusMessage: pingRes.message,
        };
      })
    );

    return tested;
  }

  /**
   * Get only enabled providers for synchronization algorithms
   */
  async getActiveProviders() {
    const providers = await this.getRawProviders();
    return providers.filter((p) => p.isEnabled !== false);
  }

  /**
   * Add a new API provider (Catalog preset or Custom REST endpoint)
   */
  async addProvider(dto) {
    const { name, desc, endpoint, category, apiKey, headers, isEnabled = true } = dto;
    if (!name || !name.trim()) {
      throw new Error("Tên nguồn API không được để trống");
    }
    if (!endpoint || !endpoint.trim()) {
      throw new Error("Endpoint URL không được để trống");
    }

    const providers = await this.getRawProviders();

    // Generate unique ID from name
    const baseSlug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/^_+|_+$/g, "") || "custom_api";

    let uniqueId = baseSlug;
    let counter = 1;
    while (providers.some((p) => p.id === uniqueId)) {
      uniqueId = `${baseSlug}_${counter++}`;
    }

    const newProvider = {
      id: uniqueId,
      name: name.trim(),
      desc: desc ? desc.trim() : "Nguồn API đồng bộ tùy chỉnh",
      category: category || "custom",
      endpoint: endpoint.trim(),
      apiKey: apiKey ? apiKey.trim() : undefined,
      headers: headers || { "Accept": "application/json" },
      isEnabled: Boolean(isEnabled),
      isBuiltIn: false,
      requiresKey: Boolean(apiKey),
      createdAt: new Date().toISOString(),
    };

    providers.push(newProvider);
    await this.saveProviders(providers);

    return newProvider;
  }

  /**
   * Update an existing API provider (Toggle enable/disable, edit details)
   */
  async updateProvider(id, dto) {
    const providers = await this.getRawProviders();
    const index = providers.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy nguồn API với ID: ${id}`);
    }

    const current = providers[index];
    const updated = {
      ...current,
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.desc !== undefined && { desc: dto.desc.trim() }),
      ...(dto.endpoint !== undefined && { endpoint: dto.endpoint.trim() }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.apiKey !== undefined && { apiKey: dto.apiKey ? dto.apiKey.trim() : undefined }),
      ...(dto.isEnabled !== undefined && { isEnabled: Boolean(dto.isEnabled) }),
      ...(dto.headers !== undefined && { headers: dto.headers }),
      updatedAt: new Date().toISOString(),
    };

    providers[index] = updated;
    await this.saveProviders(providers);

    return updated;
  }

  /**
   * Delete an API provider
   */
  async deleteProvider(id) {
    const providers = await this.getRawProviders();
    const index = providers.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy nguồn API với ID: ${id}`);
    }

    const target = providers[index];
    if (target.isBuiltIn) {
      // For core built-ins, turn off instead of permanent removal to preserve system stability
      target.isEnabled = false;
      providers[index] = target;
      await this.saveProviders(providers);
      return { message: "Đã vô hiệu hóa nguồn API mặc định thành công", provider: target };
    }

    providers.splice(index, 1);
    await this.saveProviders(providers);
    return { message: "Đã xóa nguồn API thành công", deletedId: id };
  }

  /**
   * Live ping connectivity test for an endpoint
   */
  async pingEndpoint(endpointUrl, customHeaders = {}, apiKey = null) {
    if (!endpointUrl) {
      return { success: false, status: "offline", responseTimeMs: null, message: "Thiếu endpoint URL" };
    }

    const startTime = Date.now();
    try {
      const headers = {
        "User-Agent": "PacificOceanApp/1.0 (HealthCheck)",
        ...customHeaders,
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["x-api-key"] = apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(endpointUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      if (res.ok || res.status === 304 || res.status === 400 || res.status === 401) {
        const isSlow = responseTimeMs > 2500;
        return {
          success: true,
          status: isSlow ? "slow" : "ok",
          responseTimeMs,
          statusCode: res.status,
          message: isSlow ? `Phản hồi chậm (${responseTimeMs}ms)` : `Hoạt động bình thường (${responseTimeMs}ms)`,
        };
      }

      return {
        success: false,
        status: "slow",
        responseTimeMs,
        statusCode: res.status,
        message: `Mã phản hồi HTTP: ${res.status} (${responseTimeMs}ms)`,
      };
    } catch (err) {
      const responseTimeMs = Date.now() - startTime;
      const isTimeout = err.name === "AbortError" || err.message?.includes("timeout");
      return {
        success: false,
        status: "offline",
        responseTimeMs: isTimeout ? 6000 : responseTimeMs,
        message: isTimeout ? "Hết thời gian chờ (Timeout > 6s)" : `Mất kết nối: ${err.message}`,
      };
    }
  }

  /**
   * Test live connection for a single provider ID
   */
  async testProvider(id) {
    const providers = await this.getRawProviders();
    const target = providers.find((p) => p.id === id);
    if (!target) {
      throw new Error(`Không tìm thấy nguồn API: ${id}`);
    }

    const pingRes = await this.pingEndpoint(target.endpoint, target.headers, target.apiKey);
    return {
      id: target.id,
      name: target.name,
      endpoint: target.endpoint,
      ...pingRes,
    };
  }
}

export default new ApiProviderService();
