const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const os = require("os");
const path = require("path");

const execFileAsync = promisify(execFile);

function toBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input !== "string") {
    throw new Error("eImzo: input must be Buffer or string");
  }
  const trimmed = input.trim();
  if (trimmed.startsWith("-----BEGIN")) {
    return Buffer.from(trimmed);
  }
  return Buffer.from(trimmed.replace(/\s+/g, ""), "base64");
}

function parseCertificate(input) {
  const buf = toBuffer(input);
  let cert;
  try {
    cert = new crypto.X509Certificate(buf);
  } catch (err) {
    throw new Error("eImzo: invalid X.509 certificate — " + err.message);
  }
  return {
    serialNumber: cert.serialNumber,
    validFrom:    new Date(cert.validFrom),
    validTo:      new Date(cert.validTo),
    issuer:       cert.issuer,
    subject:      cert.subject,
    fingerprint:  cert.fingerprint256,
    pem:          cert.toString(),
  };
}

function isCertValidNow(certInfo, now = new Date()) {
  if (!certInfo) return false;
  return now >= certInfo.validFrom && now <= certInfo.validTo;
}

function matchesUserCertificate(parsed, userCert) {
  if (!parsed || !userCert) return false;
  if (!userCert.serialNumber) return false;
  const norm = (s) => String(s).replace(/[:\s]/g, "").toLowerCase();
  return norm(parsed.serialNumber) === norm(userCert.serialNumber);
}

let _opensslAvailable = null;
async function hasOpenssl() {
  if (_opensslAvailable !== null) return _opensslAvailable;
  try {
    await execFileAsync("openssl", ["version"]);
    _opensslAvailable = true;
  } catch {
    _opensslAvailable = false;
  }
  return _opensslAvailable;
}

async function withTempFiles(items, fn) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "eimzo-"));
  const paths = {};
  try {
    for (const [name, data] of Object.entries(items)) {
      const p = path.join(dir, name);
      await fs.promises.writeFile(p, data);
      paths[name] = p;
    }
    return await fn(paths);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

async function verifyPkcs7({ signatureBase64, dataBuffer, dataBase64, detached = true }) {
  if (!signatureBase64) {
    return { valid: false, cert: null, error: "signatureBase64 talab etiladi" };
  }
  const dataBuf = dataBuffer || (dataBase64 ? Buffer.from(dataBase64, "base64") : null);

  const sigDer = Buffer.from(String(signatureBase64).replace(/\s+/g, ""), "base64");

  if (!(await hasOpenssl())) {
    return {
      valid:  false,
      cert:   null,
      error:  "openssl topilmadi — PKCS#7 to'liq verify uchun openssl yoki node-forge kerak",
      method: "openssl-missing",
    };
  }

  return withTempFiles(
    {
      "sig.p7s":  sigDer,
      "data.bin": dataBuf || Buffer.alloc(0),
      "cert.pem": Buffer.alloc(0),
    },
    async (paths) => {
      try {
        const args = [
          "cms", "-verify",
          "-inform", "DER",
          "-in", paths["sig.p7s"],
          "-noverify",
          "-signer", paths["cert.pem"],
          "-out", path.join(path.dirname(paths["sig.p7s"]), "out.bin"),
        ];
        if (detached && dataBuf) {
          args.push("-content", paths["data.bin"]);
        }

        const { stderr } = await execFileAsync("openssl", args, {
          maxBuffer: 8 * 1024 * 1024,
        });

        const ok = /Verification successful|Verified OK/i.test(stderr || "");

        let parsed = null;
        try {
          const pem = await fs.promises.readFile(paths["cert.pem"], "utf8");
          parsed = parseCertificate(pem);
        } catch {}

        return {
          valid: ok,
          cert: parsed,
          error: ok ? null : (stderr || "verify failed"),
          method: "openssl-cms",
        };
      } catch (err) {
        return {
          valid:  false,
          cert:   null,
          error:  err.stderr || err.message || String(err),
          method: "openssl-cms",
        };
      }
    },
  );
}

function verifyDetachedRsa({ certificatePem, signatureBase64, dataBuffer, algorithm = "RSA-SHA256" }) {
  if (!certificatePem || !signatureBase64 || !dataBuffer) {
    return { valid: false, error: "certificate, signature va data talab etiladi" };
  }
  try {
    const cert = new crypto.X509Certificate(certificatePem);
    const verify = crypto.createVerify(algorithm);
    verify.update(dataBuffer);
    verify.end();
    const ok = verify.verify(cert.publicKey, Buffer.from(signatureBase64, "base64"));
    return { valid: ok, cert: parseCertificate(certificatePem), method: "detached-rsa" };
  } catch (err) {
    return { valid: false, error: err.message, method: "detached-rsa" };
  }
}

async function verifyAndMatch({ signatureBase64, dataBuffer, userCert }) {
  const result = await verifyPkcs7({ signatureBase64, dataBuffer });
  if (!result.valid) {
    return { valid: false, reason: "signature_invalid:" + (result.error || ""), cert: result.cert };
  }
  if (!isCertValidNow(result.cert)) {
    return { valid: false, reason: "certificate_expired_or_not_yet_valid", cert: result.cert };
  }
  if (userCert && !matchesUserCertificate(result.cert, userCert)) {
    return { valid: false, reason: "certificate_mismatch_user", cert: result.cert };
  }
  return { valid: true, reason: null, cert: result.cert };
}

module.exports = {
  parseCertificate,
  isCertValidNow,
  matchesUserCertificate,
  verifyPkcs7,
  verifyDetachedRsa,
  verifyAndMatch,
  hasOpenssl,
};
