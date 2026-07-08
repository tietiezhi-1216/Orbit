#!/usr/bin/env bash
#
# Create a STABLE self-signed code-signing identity for local Orbit dev builds.
#
# Why: macOS TCC (Accessibility, Microphone, …) binds a permission grant to the
# app's code signature. Ad-hoc signing (`codesign --sign -`) produces a fresh
# CDHash on every build, so each rebuild looks like a different app to TCC and
# the user's grant silently stops applying. Signing with a stable certificate
# gives the app a constant designated requirement, so the grant persists across
# rebuilds. (Same trick yabai / skhd document for the same reason.)
#
# The certificate is self-signed and only ever used locally — it is NOT for
# distribution. Run once; build.sh picks it up automatically afterwards.
#
set -euo pipefail

CN="Orbit Self-Signed"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

# NB: use `-p codesigning` WITHOUT `-v` — a self-signed cert is untrusted by
# Gatekeeper so `-v` (valid-only) hides it, but codesign can still sign with it.
if security find-identity -p codesigning | grep -q "$CN"; then
    echo "✅ signing identity '$CN' already exists — nothing to do."
    exit 0
fi

echo "▶ creating self-signed code-signing certificate '$CN'…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/req.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions    = ext
prompt             = no
[dn]
CN = $CN
[ext]
basicConstraints     = critical, CA:false
keyUsage             = critical, digitalSignature
extendedKeyUsage     = critical, codeSigning
EOF

openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
    -keyout "$TMP/key.pem" -out "$TMP/cert.pem" -config "$TMP/req.cnf" 2>/dev/null

# `-legacy` makes OpenSSL 3 emit the older PBE/MAC algorithms that Apple's
# `security import` understands (the modern defaults trip "MAC verification
# failed"). Fall back to explicit legacy ciphers if the flag isn't available.
openssl pkcs12 -export -legacy -out "$TMP/id.p12" \
    -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
    -name "$CN" -passout pass:orbit 2>/dev/null \
|| openssl pkcs12 -export -out "$TMP/id.p12" \
    -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
    -name "$CN" -passout pass:orbit \
    -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1 2>/dev/null

# -A: let any tool use the key without a per-use prompt (fine for a dev key).
# -T /usr/bin/codesign: explicitly authorise codesign.
security import "$TMP/id.p12" -k "$KEYCHAIN" -P orbit -A -T /usr/bin/codesign >/dev/null

echo "✅ imported. codesigning identity:"
security find-identity -p codesigning | grep "$CN" || {
    echo "⚠️  identity not found after import — check Keychain Access."; exit 1; }

echo
echo "Next: rebuild (./build.sh run). Then grant Orbit Accessibility ONCE more"
echo "(the identity changed). It will stick across future rebuilds."
