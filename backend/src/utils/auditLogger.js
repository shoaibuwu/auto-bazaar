import crypto from "crypto";
import AuditLog from "../models/auditLog.model.js";

/**
 * Compute SHA-256 hash for an audit log record
 */
export function computeLogHash({ previousHash, action, actor, targetEntity, timestamp, metadata }) {
  const payload = [
    previousHash || "GENESIS_HASH_00000000000000000000000000000000000000000000000000000000",
    action || "",
    actor?.name || "",
    actor?.email || "",
    targetEntity?.entityId || "",
    new Date(timestamp).toISOString(),
    JSON.stringify(metadata || {}),
  ].join("|");

  return "0x" + crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Record a new cryptographic audit log entry
 */
export async function recordAuditLog({
  actor = {},
  action,
  actionCategory = "admin",
  summary,
  targetEntity = {},
  ipAddress = "127.0.0.1",
  userAgent = "AutoBazaar-Admin-Client",
  metadata = {},
  timestamp = new Date(),
}) {
  try {
    // Find the latest log by insertion order (_id: -1) to link the previous hash
    const latestLog = await AuditLog.findOne().sort({ _id: -1 }).lean();
    const previousHash =
      latestLog?.hash ||
      "0x" + crypto.createHash("sha256").update("AUTOBAZAAR_GENESIS_ROOT").digest("hex");

    const hash = computeLogHash({
      previousHash,
      action,
      actor,
      targetEntity,
      timestamp,
      metadata,
    });

    const logEntry = await AuditLog.create({
      actor: {
        id: actor.id || actor._id || null,
        name: actor.name || "System",
        email: actor.email || "",
        role: actor.role || "admin",
      },
      action,
      actionCategory,
      summary,
      targetEntity: {
        entityType: targetEntity.entityType || "Listing",
        entityId: targetEntity.entityId || "",
        entityTitle: targetEntity.entityTitle || "",
      },
      ipAddress: ipAddress || "127.0.0.1",
      userAgent: userAgent || "AutoBazaar-Admin-Client",
      metadata,
      previousHash,
      hash,
      timestamp,
    });

    return logEntry;
  } catch (err) {
    console.error("Failed to record audit log:", err);
    return null;
  }
}

/**
 * Verify cryptographic hash integrity of the entire audit chain
 */
export async function verifyAuditChainIntegrity() {
  const logs = await AuditLog.find().sort({ _id: 1 }).lean();

  if (logs.length === 0) {
    return {
      isValid: true,
      verifiedCount: 0,
      merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
      brokenIndex: -1,
    };
  }

  let expectedPrevHash =
    "0x" + crypto.createHash("sha256").update("AUTOBAZAAR_GENESIS_ROOT").digest("hex");

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Verify link to previous block
    if (log.previousHash !== expectedPrevHash) {
      return {
        isValid: false,
        verifiedCount: i,
        brokenIndex: i,
        error: `Hash chain broken at index ${i}: expected previousHash ${expectedPrevHash}, found ${log.previousHash}`,
      };
    }

    // Verify self hash computation
    const computed = computeLogHash({
      previousHash: log.previousHash,
      action: log.action,
      actor: log.actor,
      targetEntity: log.targetEntity,
      timestamp: log.timestamp,
      metadata: log.metadata,
    });

    if (computed !== log.hash) {
      return {
        isValid: false,
        verifiedCount: i,
        brokenIndex: i,
        error: `Checksum mismatch at index ${i}: computed ${computed}, found ${log.hash}`,
      };
    }

    expectedPrevHash = log.hash;
  }

  // Compute final Merkle / Ledger root hash of the entire chain
  const merkleRoot =
    logs.length > 0
      ? logs[logs.length - 1].hash
      : "0x" + crypto.createHash("sha256").update("EMPTY_LEDGER").digest("hex");

  return {
    isValid: true,
    verifiedCount: logs.length,
    merkleRoot,
    brokenIndex: -1,
  };
}
