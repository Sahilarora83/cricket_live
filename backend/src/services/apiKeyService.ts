import { ApiKeyModel } from "../models/ApiKey.js";
import { ApiRequestLogModel } from "../models/ApiRequestLog.js";
import { ApiKeyOtpModel } from "../models/ApiKeyOtp.js";
import { env } from "../config/env.js";
import crypto from "node:crypto";
import { canPersist } from "../utils/persistence.js";
import { currentUsageMonth, generateApiKey, generateOtpCode, hashApiKey, hashOtp } from "../utils/apiKeys.js";
import { canSendEmail, sendOtpEmail } from "./emailService.js";

export class ApiKeyServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeAllowedOrigins(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]/) : [];
  const origins = values
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .map((item) => item.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((item) => item === "localhost" || /^[a-z0-9.-]+(?::\d+)?$/.test(item));
  return Array.from(new Set(origins)).slice(0, 10);
}

function originHost(value?: string) {
  if (!value) return "";
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

function originAllowed(requestOrigin: string, allowedOrigins: string[], trustedInternalOrigin?: boolean) {
  if (allowedOrigins.length === 0) return true;
  if (trustedInternalOrigin) return true;
  const host = originHost(requestOrigin);
  if (!host) return false;
  return allowedOrigins.some((allowedOrigin) => {
    const allowed = allowedOrigin.toLowerCase();
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

function adminEmails() {
  return env.API_ADMIN_EMAILS.split(/[,\s]+/).map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isApiAdmin(email: string) {
  return adminEmails().includes(normalizeEmail(email));
}

export class ApiKeyService {
  async requestOtp(input: { email: string; purpose: "create" | "revoke" }) {
    if (!canPersist()) {
      throw new ApiKeyServiceError("MongoDB is required for API key verification", 503);
    }

    const email = normalizeEmail(input.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiKeyServiceError("Valid email is required", 400);
    }

    const recent = await ApiKeyOtpModel.findOne({ email, purpose: input.purpose }).sort({ createdAt: -1 }).lean();
    if (recent?.createdAt) {
      const secondsSinceLastOtp = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
      if (secondsSinceLastOtp < env.API_KEY_OTP_RESEND_SECONDS) {
        throw new ApiKeyServiceError(`Please wait ${Math.ceil(env.API_KEY_OTP_RESEND_SECONDS - secondsSinceLastOtp)} seconds before requesting another code.`, 429);
      }
    }

    const code = generateOtpCode();
    await ApiKeyOtpModel.create({
      email,
      codeHash: hashOtp(email, code, input.purpose),
      purpose: input.purpose,
      expiresAt: new Date(Date.now() + env.API_KEY_OTP_TTL_MINUTES * 60 * 1000)
    });

    const delivery = await sendOtpEmail({ email, code, purpose: input.purpose });
    return {
      email,
      delivered: delivery.delivered,
      expiresInMinutes: env.API_KEY_OTP_TTL_MINUTES,
      resendAfterSeconds: env.API_KEY_OTP_RESEND_SECONDS,
      devCode: canSendEmail() || env.NODE_ENV === "production" ? undefined : code
    };
  }

  async createApiKey(input: { name: string; email: string; allowedOrigins?: unknown; otp?: string; verifiedByGoogle?: boolean }) {
    if (!canPersist()) {
      throw new ApiKeyServiceError("MongoDB is required to generate API keys", 503);
    }

    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const allowedOrigins = normalizeAllowedOrigins(input.allowedOrigins);
    if (!name) {
      throw new ApiKeyServiceError("App name is required", 400);
    }
    if (allowedOrigins.length === 0) {
      throw new ApiKeyServiceError("At least one allowed domain is required", 400);
    }
    if (!input.verifiedByGoogle) {
      await this.verifyOtp(email, input.otp || "", "create");
    }

    const activeKeyCount = await ApiKeyModel.countDocuments({ email, revoked: false });
    if (activeKeyCount >= env.API_MAX_ACTIVE_KEYS_PER_EMAIL) {
      throw new ApiKeyServiceError(
        `This email already has ${activeKeyCount} active API key${activeKeyCount === 1 ? "" : "s"}. Limit is ${env.API_MAX_ACTIVE_KEYS_PER_EMAIL} per email.`,
        409
      );
    }
    await this.assertCreateAllowed(email);

    const { key, keyPrefix } = generateApiKey();
    const verificationToken = `cricket-live-site-verification=${crypto.randomBytes(18).toString("hex")}`;
    const record = await ApiKeyModel.create({
      name,
      email,
      keyPrefix,
      keyHash: hashApiKey(key),
      allowedOrigins,
      requestedDomains: allowedOrigins,
      approvedDomains: [],
      approvalStatus: "pending",
      verificationToken,
      plan: "open-source",
      monthlyQuota: env.API_FREE_MONTHLY_QUOTA,
      usageMonth: currentUsageMonth(),
      usageCount: 0
    });

    return {
      key,
      keyPrefix: record.keyPrefix,
      requestedDomains: record.requestedDomains,
      approvedDomains: record.approvedDomains,
      approvalStatus: record.approvalStatus,
      verificationToken: record.verificationToken,
      verificationFile: "/cricket-live-verify.txt",
      plan: record.plan,
      monthlyQuota: record.monthlyQuota,
      maxActiveKeysPerEmail: env.API_MAX_ACTIVE_KEYS_PER_EMAIL,
      usageCount: record.usageCount,
      usageMonth: record.usageMonth,
      remaining: record.monthlyQuota
    };
  }

  async revokeApiKeys(input: { email: string; otp?: string; keyPrefix?: string; verifiedByGoogle?: boolean }) {
    if (!canPersist()) {
      throw new ApiKeyServiceError("MongoDB is required to revoke API keys", 503);
    }

    const email = normalizeEmail(input.email);
    if (!input.verifiedByGoogle) {
      await this.verifyOtp(email, input.otp || "", "revoke");
    }

    const filter: Record<string, unknown> = { email, revoked: false };
    if (input.keyPrefix?.trim()) {
      filter.keyPrefix = input.keyPrefix.trim();
    }

    const result = await ApiKeyModel.updateMany(filter, { $set: { revoked: true, revokedAt: new Date() } });
    if (result.modifiedCount === 0) {
      throw new ApiKeyServiceError("No active API key found for this email.", 404);
    }

    return { revoked: result.modifiedCount };
  }

  async listApiKeysForEmail(emailInput: string) {
    if (!canPersist()) {
      throw new ApiKeyServiceError("MongoDB is required to load API key usage", 503);
    }

    const email = normalizeEmail(emailInput);
    const usageMonth = currentUsageMonth();
    const keys = await ApiKeyModel.find({ email })
      .sort({ revoked: 1, createdAt: -1 })
      .limit(20)
      .lean();
    const recentLogs = await ApiRequestLogModel.find({ email })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();
    const activeKeys = keys.filter((key) => !key.revoked);
    const emailUsageCount = activeKeys
      .filter((key) => key.usageMonth === usageMonth)
      .reduce((total, key) => total + Number(key.usageCount || 0), 0);
    const monthlyQuota = activeKeys[0]?.monthlyQuota ?? env.API_FREE_MONTHLY_QUOTA;

    return {
      email,
      isAdmin: isApiAdmin(email),
      usageMonth,
      monthlyQuota,
      emailUsageCount,
      remaining: Math.max(monthlyQuota - emailUsageCount, 0),
      activeKeyCount: activeKeys.length,
      maxActiveKeysPerEmail: env.API_MAX_ACTIVE_KEYS_PER_EMAIL,
      rateLimit: {
        limit: env.API_KEY_RATE_LIMIT_MAX,
        windowMs: env.API_KEY_RATE_LIMIT_WINDOW_MS
      },
      limits: {
        dailyCreateLimit: env.API_KEY_DAILY_CREATE_LIMIT,
        createCooldownSeconds: env.API_KEY_CREATE_COOLDOWN_SECONDS,
        revokeCooldownSeconds: env.API_KEY_REVOKE_COOLDOWN_SECONDS
      },
      keys: keys.map((key) => ({
        name: key.name,
        email: key.email,
        keyPrefix: key.keyPrefix,
        requestedDomains: key.requestedDomains || key.allowedOrigins || [],
        approvedDomains: key.approvedDomains || [],
        allowedOrigins: key.allowedOrigins || [],
        approvalStatus: key.approvalStatus || "pending",
        verificationToken: key.verificationToken || "",
        verificationFile: "/cricket-live-verify.txt",
        reviewedAt: key.reviewedAt,
        reviewedBy: key.reviewedBy,
        rejectionReason: key.rejectionReason,
        plan: key.plan,
        monthlyQuota: key.monthlyQuota,
        usageMonth: key.usageMonth,
        usageCount: key.usageMonth === usageMonth ? key.usageCount : 0,
        remaining: key.revoked || key.usageMonth !== usageMonth ? key.monthlyQuota : Math.max(key.monthlyQuota - key.usageCount, 0),
        revoked: key.revoked,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
        lastUsedAt: key.lastUsedAt
      })),
      recentLogs: recentLogs.map((log) => ({
        keyPrefix: log.keyPrefix,
        method: log.method,
        path: log.path,
        origin: log.origin || "",
        status: log.status,
        message: log.message || "",
        createdAt: log.createdAt
      }))
    };
  }

  async consumeApiKey(rawKey: string, requestMeta?: { method?: string; path?: string; origin?: string; trustedInternalOrigin?: boolean }) {
    if (!canPersist()) {
      return { ok: false as const, status: 503, error: "API key storage is unavailable" };
    }

    const keyHash = hashApiKey(rawKey);
    const apiKey = await ApiKeyModel.findOne({ keyHash, revoked: false });
    if (!apiKey) {
      return { ok: false as const, status: 401, error: "Invalid API key" };
    }

    if ((apiKey.approvalStatus || "pending") !== "approved") {
      await this.logApiRequest({
        email: apiKey.email,
        keyPrefix: apiKey.keyPrefix,
        method: requestMeta?.method || "GET",
        path: requestMeta?.path || "",
        origin: requestMeta?.origin,
        status: 403,
        message: `Key ${apiKey.approvalStatus || "pending"}`
      });
      return { ok: false as const, status: 403, error: "API key is waiting for administrator approval" };
    }

    const approvedDomains = apiKey.approvedDomains?.length ? apiKey.approvedDomains : apiKey.allowedOrigins || [];
    if (!originAllowed(requestMeta?.origin || "", approvedDomains, requestMeta?.trustedInternalOrigin)) {
      await this.logApiRequest({
        email: apiKey.email,
        keyPrefix: apiKey.keyPrefix,
        method: requestMeta?.method || "GET",
        path: requestMeta?.path || "",
        origin: requestMeta?.origin,
        status: 403,
        message: "Origin not allowed"
      });
      return { ok: false as const, status: 403, error: "This API key is not allowed from this domain" };
    }

    const usageMonth = currentUsageMonth();
    if (apiKey.usageMonth !== usageMonth) {
      apiKey.usageMonth = usageMonth;
      apiKey.usageCount = 0;
    }

    const emailUsage = await ApiKeyModel.aggregate<{ total: number }>([
      {
        $match: {
          email: apiKey.email,
          revoked: false,
          usageMonth
        }
      },
      {
        $group: {
          _id: "$email",
          total: { $sum: "$usageCount" }
        }
      }
    ]);
    const emailUsageCount = emailUsage[0]?.total ?? 0;

    if (emailUsageCount >= apiKey.monthlyQuota) {
      return { ok: false as const, status: 429, error: "Monthly API quota exceeded" };
    }

    apiKey.usageCount += 1;
    apiKey.lastUsedAt = new Date();
    await apiKey.save();
    const updatedEmailUsageCount = emailUsageCount + 1;
    await this.logApiRequest({
      email: apiKey.email,
      keyPrefix: apiKey.keyPrefix,
      method: requestMeta?.method || "GET",
      path: requestMeta?.path || "",
      origin: requestMeta?.origin,
      status: 200,
      message: "OK"
    });

    return {
      ok: true as const,
      usage: {
        keyPrefix: apiKey.keyPrefix,
        plan: apiKey.plan,
        monthlyQuota: apiKey.monthlyQuota,
        usageMonth: apiKey.usageMonth,
        usageCount: apiKey.usageCount,
        emailUsageCount: updatedEmailUsageCount,
        remaining: Math.max(apiKey.monthlyQuota - updatedEmailUsageCount, 0)
      }
    };
  }

  private async logApiRequest(input: { email: string; keyPrefix: string; method: string; path: string; origin?: string; status: number; message?: string }) {
    try {
      await ApiRequestLogModel.create(input);
    } catch {
      // Request logging must never break API access.
    }
  }

  async listApprovalRequests(adminEmail: string) {
    if (!isApiAdmin(adminEmail)) {
      throw new ApiKeyServiceError("Administrator access is required", 403);
    }
    const keys = await ApiKeyModel.find({ revoked: false })
      .sort({ approvalStatus: 1, createdAt: -1 })
      .limit(100)
      .lean();
    return {
      isAdmin: true,
      requests: keys.map((key) => ({
        name: key.name,
        email: key.email,
        keyPrefix: key.keyPrefix,
        requestedDomains: key.requestedDomains || key.allowedOrigins || [],
        approvedDomains: key.approvedDomains || [],
        approvalStatus: key.approvalStatus || "pending",
        verificationToken: key.verificationToken || "",
        verificationFile: "/cricket-live-verify.txt",
        createdAt: key.createdAt,
        reviewedAt: key.reviewedAt,
        reviewedBy: key.reviewedBy,
        rejectionReason: key.rejectionReason
      }))
    };
  }

  async getAdminOverview(adminEmail: string) {
    if (!isApiAdmin(adminEmail)) {
      throw new ApiKeyServiceError("Administrator access is required", 403);
    }

    const usageMonth = currentUsageMonth();
    const keys = await ApiKeyModel.find({})
      .sort({ createdAt: -1 })
      .limit(250)
      .lean();
    const recentLogs = await ApiRequestLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const userMap = new Map<string, { email: string; keys: number; activeKeys: number; usage: number; pending: number; approved: number; rejected: number; blocked: number }>();

    for (const key of keys) {
      const row =
        userMap.get(key.email) ||
        { email: key.email, keys: 0, activeKeys: 0, usage: 0, pending: 0, approved: 0, rejected: 0, blocked: 0 };
      row.keys += 1;
      if (!key.revoked) row.activeKeys += 1;
      if (key.revoked) row.blocked += 1;
      if ((key.approvalStatus || "pending") === "pending") row.pending += 1;
      if (key.approvalStatus === "approved") row.approved += 1;
      if (key.approvalStatus === "rejected") row.rejected += 1;
      if (key.usageMonth === usageMonth) row.usage += Number(key.usageCount || 0);
      userMap.set(key.email, row);
    }

    const pendingCount = keys.filter((key) => !key.revoked && (key.approvalStatus || "pending") === "pending").length;
    const approvedCount = keys.filter((key) => !key.revoked && key.approvalStatus === "approved").length;
    const blockedCount = keys.filter((key) => key.revoked).length;
    const totalUsage = keys.filter((key) => key.usageMonth === usageMonth).reduce((total, key) => total + Number(key.usageCount || 0), 0);

    return {
      usageMonth,
      stats: {
        users: userMap.size,
        keys: keys.length,
        pending: pendingCount,
        approved: approvedCount,
        blocked: blockedCount,
        usage: totalUsage
      },
      users: Array.from(userMap.values()).sort((a, b) => b.usage - a.usage),
      keys: keys.map((key) => ({
        name: key.name,
        email: key.email,
        keyPrefix: key.keyPrefix,
        requestedDomains: key.requestedDomains || key.allowedOrigins || [],
        approvedDomains: key.approvedDomains || [],
        approvalStatus: key.approvalStatus || "pending",
        verificationToken: key.verificationToken || "",
        usageMonth: key.usageMonth,
        usageCount: key.usageMonth === usageMonth ? key.usageCount : 0,
        monthlyQuota: key.monthlyQuota,
        revoked: key.revoked,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        reviewedAt: key.reviewedAt,
        reviewedBy: key.reviewedBy,
        rejectionReason: key.rejectionReason
      })),
      recentLogs: recentLogs.map((log) => ({
        email: log.email,
        keyPrefix: log.keyPrefix,
        method: log.method,
        path: log.path,
        origin: log.origin || "",
        status: log.status,
        message: log.message || "",
        createdAt: log.createdAt
      }))
    };
  }

  async blockApiKey(input: { adminEmail: string; keyPrefix: string }) {
    if (!isApiAdmin(input.adminEmail)) {
      throw new ApiKeyServiceError("Administrator access is required", 403);
    }
    const result = await ApiKeyModel.updateOne(
      { keyPrefix: input.keyPrefix },
      { $set: { revoked: true, revokedAt: new Date(), approvalStatus: "rejected", rejectionReason: "Blocked by administrator" } }
    );
    if (result.modifiedCount === 0) {
      throw new ApiKeyServiceError("API key not found", 404);
    }
    return { blocked: true, keyPrefix: input.keyPrefix };
  }

  async reviewApproval(input: { adminEmail: string; keyPrefix: string; action: "approve" | "reject"; reason?: string }) {
    if (!isApiAdmin(input.adminEmail)) {
      throw new ApiKeyServiceError("Administrator access is required", 403);
    }
    const key = await ApiKeyModel.findOne({ keyPrefix: input.keyPrefix, revoked: false });
    if (!key) {
      throw new ApiKeyServiceError("Approval request not found", 404);
    }
    if (input.action === "approve") {
      const domains = key.requestedDomains?.length ? key.requestedDomains : key.allowedOrigins || [];
      key.approvalStatus = "approved";
      key.approvedDomains = domains;
      key.allowedOrigins = domains;
      key.rejectionReason = undefined;
    } else {
      key.approvalStatus = "rejected";
      key.approvedDomains = [];
      key.rejectionReason = input.reason?.trim() || "Rejected by administrator";
    }
    key.reviewedAt = new Date();
    key.reviewedBy = normalizeEmail(input.adminEmail);
    await key.save();
    return {
      keyPrefix: key.keyPrefix,
      approvalStatus: key.approvalStatus,
      approvedDomains: key.approvedDomains,
      rejectionReason: key.rejectionReason
    };
  }

  async verifyApprovalDomain(input: { adminEmail: string; keyPrefix: string; domain: string }) {
    if (!isApiAdmin(input.adminEmail)) {
      throw new ApiKeyServiceError("Administrator access is required", 403);
    }

    const key = await ApiKeyModel.findOne({ keyPrefix: input.keyPrefix, revoked: false }).lean();
    if (!key) {
      throw new ApiKeyServiceError("Approval request not found", 404);
    }

    const domain = normalizeAllowedOrigins(input.domain)[0];
    if (!domain) {
      throw new ApiKeyServiceError("Valid domain is required", 400);
    }

    const requestedDomains = key.requestedDomains?.length ? key.requestedDomains : key.allowedOrigins || [];
    if (!requestedDomains.includes(domain)) {
      throw new ApiKeyServiceError("Domain is not part of this approval request", 400);
    }

    const url = `https://${domain}/cricket-live-verify.txt`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      const body = (await response.text()).trim();
      clearTimeout(timeout);

      return {
        domain,
        url,
        ok: response.ok && body === key.verificationToken,
        status: response.status,
        expected: key.verificationToken,
        received: body.slice(0, 240)
      };
    } catch (error) {
      return {
        domain,
        url,
        ok: false,
        status: 0,
        expected: key.verificationToken,
        received: error instanceof Error ? error.message : "Verification request failed"
      };
    }
  }

  private async assertCreateAllowed(email: string) {
    if (env.API_KEY_CREATE_COOLDOWN_SECONDS > 0) {
      const lastKey = await ApiKeyModel.findOne({ email }).sort({ createdAt: -1 }).lean();
      if (lastKey?.createdAt) {
        const secondsSinceLastKey = (Date.now() - new Date(lastKey.createdAt).getTime()) / 1000;
        if (secondsSinceLastKey < env.API_KEY_CREATE_COOLDOWN_SECONDS) {
          throw new ApiKeyServiceError(
            `Please wait ${Math.ceil(env.API_KEY_CREATE_COOLDOWN_SECONDS - secondsSinceLastKey)} seconds before generating another key.`,
            429
          );
        }
      }
    }

    if (env.API_KEY_REVOKE_COOLDOWN_SECONDS > 0) {
      const lastRevokedKey = await ApiKeyModel.findOne({ email, revoked: true, revokedAt: { $exists: true } }).sort({ revokedAt: -1 }).lean();
      if (lastRevokedKey?.revokedAt) {
        const secondsSinceRevoke = (Date.now() - new Date(lastRevokedKey.revokedAt).getTime()) / 1000;
        if (secondsSinceRevoke < env.API_KEY_REVOKE_COOLDOWN_SECONDS) {
          throw new ApiKeyServiceError(
            `Please wait ${Math.ceil(env.API_KEY_REVOKE_COOLDOWN_SECONDS - secondsSinceRevoke)} seconds after revoking before generating a new key.`,
            429
          );
        }
      }
    }

    const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const keysCreatedToday = await ApiKeyModel.countDocuments({ email, createdAt: { $gte: dayStart } });
    if (keysCreatedToday >= env.API_KEY_DAILY_CREATE_LIMIT) {
      throw new ApiKeyServiceError(
        `Daily API key generation limit reached. You can create ${env.API_KEY_DAILY_CREATE_LIMIT} key${env.API_KEY_DAILY_CREATE_LIMIT === 1 ? "" : "s"} per 24 hours.`,
        429
      );
    }
  }

  private async verifyOtp(email: string, code: string, purpose: "create" | "revoke") {
    const normalizedEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ApiKeyServiceError("Valid email is required", 400);
    }

    const otp = await ApiKeyOtpModel.findOne({
      email: normalizedEmail,
      purpose,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!otp) {
      throw new ApiKeyServiceError("OTP is invalid or expired.", 401);
    }

    if (otp.attempts >= env.API_KEY_OTP_MAX_ATTEMPTS) {
      throw new ApiKeyServiceError("Too many OTP attempts. Request a new code.", 429);
    }

    if (otp.codeHash !== hashOtp(normalizedEmail, code.trim(), purpose)) {
      otp.attempts += 1;
      await otp.save();
      throw new ApiKeyServiceError("OTP is invalid or expired.", 401);
    }

    otp.consumedAt = new Date();
    await otp.save();
  }
}
